import {
	paginationOptsValidator,
	paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { env, internalAction, internalQuery } from "./_generated/server";
import { parseClerkUser } from "./clerkWebhook";

const account = v.object({ clerkId: v.string(), email: v.string() });
export const accounts = internalQuery({
	args: { paginationOpts: paginationOptsValidator },
	returns: paginationResultValidator(account),
	handler: async (ctx, args) => {
		if (!env.CLERK_JWT_ISSUER_DOMAIN)
			throw new Error("Clerk issuer is not configured");
		const prefix = `${env.CLERK_JWT_ISSUER_DOMAIN}|`;
		const page = await ctx.db
			.query("users")
			.withIndex("by_tokenIdentifier", (q) =>
				q
					.gte("tokenIdentifier", prefix)
					.lt("tokenIdentifier", `${prefix}\uffff`),
			)
			.paginate(args.paginationOpts);
		return {
			...page,
			page: page.page.map((user) => ({
				clerkId: user.clerkId,
				email: user.email,
			})),
		};
	},
});

async function clerkGet(path: string) {
	if (
		!env.CLERK_SECRET_KEY ||
		!env.CLERK_WEBHOOK_INSTANCE_ID ||
		!env.CLERK_JWT_ISSUER_DOMAIN
	)
		throw new Error("Clerk reconciliation is not configured");
	const response = await fetch(`https://api.clerk.com/v1/${path}`, {
		headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
		signal: AbortSignal.timeout(10_000),
	});
	// Only an authenticated, instance-checked 404 is absence. 401/403/429/5xx
	// must fail the audit and must never enqueue a deletion.
	if (response.status === 404 && path.startsWith("users/")) return null;
	if (!response.ok)
		throw new Error(`Clerk reconciliation HTTP ${response.status}`);
	return response.json() as Promise<unknown>;
}

async function verifyInstance() {
	const instance = await clerkGet("instance");
	if (
		!instance ||
		typeof instance !== "object" ||
		!("id" in instance) ||
		instance.id !== env.CLERK_WEBHOOK_INSTANCE_ID
	)
		throw new Error("Clerk API key belongs to another instance");
}

export const audit = internalAction({
	args: { paginationOpts: paginationOptsValidator },
	returns: v.object({
		isDone: v.boolean(),
		continueCursor: v.string(),
		checked: v.number(),
		missing: v.array(v.string()),
		emailChanged: v.array(v.string()),
		unverifiedPrimary: v.array(v.string()),
	}),
	handler: async (
		ctx,
		args,
	): Promise<{
		isDone: boolean;
		continueCursor: string;
		checked: number;
		missing: string[];
		emailChanged: string[];
		unverifiedPrimary: string[];
	}> => {
		if (
			!Number.isInteger(args.paginationOpts.numItems) ||
			args.paginationOpts.numItems < 1 ||
			args.paginationOpts.numItems > 20
		)
			throw new Error("Audit at most 20 accounts per page");
		await verifyInstance();
		const page = await ctx.runQuery(
			internal.clerkReconciliation.accounts,
			args,
		);
		if (page.page.length > 20)
			throw new Error("Audit page exceeds the provider request bound");
		const missing: string[] = [],
			emailChanged: string[] = [],
			unverifiedPrimary: string[] = [];
		for (const account of page.page) {
			const raw = await clerkGet(
				`users/${encodeURIComponent(account.clerkId)}`,
			);
			if (!raw) {
				missing.push(account.clerkId);
				continue;
			}
			const user = parseClerkUser(raw);
			if (user.clerkId !== account.clerkId)
				throw new Error("Clerk identity mismatch");
			if (!user.verifiedEmail) unverifiedPrimary.push(user.clerkId);
			else if (user.verifiedEmail !== account.email)
				emailChanged.push(user.clerkId);
		}
		return {
			isDone: page.isDone,
			continueCursor: page.continueCursor,
			checked: page.page.length,
			missing,
			emailChanged,
			unverifiedPrimary,
		};
	},
});

// Explicit, per-ID operator repair; audit never calls this function.
export const reconcileAccount = internalAction({
	args: { clerkId: v.string(), dryRun: v.optional(v.boolean()) },
	returns: v.union(
		v.literal("missing"),
		v.literal("present"),
		v.literal("applied"),
		v.literal("ignored"),
	),
	handler: async (
		ctx,
		args,
	): Promise<"missing" | "present" | "applied" | "ignored"> => {
		if (!args.clerkId.startsWith("user_")) throw new Error("Invalid Clerk ID");
		await verifyInstance();
		const raw = await clerkGet(`users/${encodeURIComponent(args.clerkId)}`);
		const user = raw ? parseClerkUser(raw) : null;
		if (user && user.clerkId !== args.clerkId)
			throw new Error("Clerk identity mismatch");
		if (args.dryRun !== false) return user ? "present" : "missing";
		const now = Date.now();
		return await ctx.runMutation(internal.clerkLifecycle.apply, {
			instanceId: env.CLERK_WEBHOOK_INSTANCE_ID ?? "",
			clerkId: args.clerkId,
			updatedAt: user?.updatedAt ?? now,
			eventAt: now,
			deleted: user === null,
			verifiedEmail: user?.verifiedEmail,
		});
	},
});
