import { type Infer, v } from "convex/values";
import { splitClerkName } from "../src/lib/clerk-registration";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, env, internalAction } from "./_generated/server";
import { createLoopsClient, LoopsFailure } from "./loopsClient";
import { loopsError } from "./loopsContract";

async function syncStudent(
	ctx: ActionCtx,
	id: Id<"loopsStudents">,
	client: ReturnType<typeof createLoopsClient>,
	listId: string,
	runId: string,
	dryRun: boolean,
) {
	const current = await ctx.runQuery(internal.loopsState.inspect, { id });
	if (!current) return "skipped" as const;
	const { job } = current;
	try {
		if (job.listId && job.listId !== listId)
			throw new LoopsFailure("destination_changed");
		const existing = await client.find("userId", job.clerkId);
		if (
			existing &&
			(existing.userId !== job.clerkId ||
				(job.contactId && existing.id !== job.contactId))
		)
			throw new LoopsFailure("identity_conflict");
		if (job.deleted) {
			if (dryRun) return "wouldSync" as const;
			if (existing) await client.remove(job.clerkId);
			else if (job.createAttempted && !job.contactId)
				throw new LoopsFailure("uncertain_create");
			await ctx.runMutation(internal.loopsState.finish, {
				id,
				version: job.version,
				deleted: true,
			});
			return "synced" as const;
		}
		if (!current.valid) throw new LoopsFailure("identity_conflict");
		if (current.founder) throw new LoopsFailure("internal_account");
		if (!job.accountEmail) throw new LoopsFailure("identity_conflict");
		const byEmail = await client.find("email", job.accountEmail);
		if (byEmail && byEmail.id !== existing?.id)
			throw new LoopsFailure("identity_conflict");
		if (
			existing &&
			existing.email.toLowerCase() !== job.accountEmail.toLowerCase()
		)
			throw new LoopsFailure("email_changed");
		if (!existing && job.contactId) throw new LoopsFailure("contact_missing");
		if (!existing && job.createAttempted)
			throw new LoopsFailure("uncertain_create");
		if (existing && existing.mailingLists[listId] !== true)
			throw new LoopsFailure("list_membership");
		if (dryRun) return "wouldSync" as const;
		const ready = await ctx.runMutation(internal.loopsState.prepare, {
			id,
			version: job.version,
			listId,
			runId,
			create: !existing,
		});
		if (!ready) return "skipped" as const;
		const splitName = splitClerkName(current.name);
		const name =
			current.name === undefined
				? {}
				: {
						firstName: splitName.firstName ?? "",
						lastName: splitName.lastName ?? "",
					};
		const contactId = await client.write(!existing, {
			userId: job.clerkId,
			...name,
			// Only the create endpoint receives a list assignment. Updates cannot re-subscribe.
			...(!existing
				? {
						email: job.accountEmail,
						source: "Dayova App",
						userGroup: "students",
						mailingLists: { [listId]: true },
					}
				: {}),
		});
		if (existing && existing.id !== contactId)
			throw new LoopsFailure("identity_conflict");
		await ctx.runMutation(internal.loopsState.finish, {
			id,
			version: job.version,
			contactId,
		});
		return "synced" as const;
	} catch (error) {
		const failure =
			error instanceof LoopsFailure
				? error
				: new LoopsFailure("unavailable", 60_000);
		const globalFailure = [
			"rate_limited",
			"unavailable",
			"unauthorized",
		].includes(failure.category);
		if (!dryRun && (!globalFailure || failure.retryAfterMs !== undefined))
			await ctx.runMutation(internal.loopsState.finish, {
				id,
				version: job.version,
				error: failure.category,
				...(failure.retryAfterMs !== undefined
					? {
							retryAt:
								Date.now() +
								Math.max(
									failure.retryAfterMs,
									Math.min(3_600_000, 60_000 * 2 ** Math.min(job.attempts, 6)),
								),
						}
					: {}),
			});
		// Stop the entire batch on provider throttling/outage, not only this contact.
		if (globalFailure) throw failure;
		return "failed" as const;
	}
}

export const reconcile = internalAction({
	args: { dryRun: v.optional(v.boolean()) },
	returns: v.object({
		status: v.union(
			v.literal("disabled"),
			v.literal("busy"),
			v.literal("complete"),
			v.literal("failed"),
		),
		synced: v.number(),
		wouldSync: v.number(),
		failed: v.number(),
		skipped: v.number(),
		error: v.optional(loopsError),
	}),
	handler: async (ctx, args) => {
		const counts = { synced: 0, wouldSync: 0, failed: 0, skipped: 0 };
		if (env.LOOPS_MODE !== "live" && !args.dryRun)
			return { status: "disabled" as const, ...counts };
		const dryRun = args.dryRun === true;
		const runId = crypto.randomUUID();
		if (!(await ctx.runMutation(internal.loopsState.begin, { runId })))
			return { status: "busy" as const, ...counts };
		let error: Infer<typeof loopsError> | undefined;
		let retryAt: number | undefined;
		try {
			if (!env.LOOPS_API_KEY || !env.LOOPS_STUDENT_LIST_ID)
				throw new LoopsFailure("configuration");
			const client = createLoopsClient(env.LOOPS_API_KEY);
			await client.checkList(env.LOOPS_STUDENT_LIST_ID);
			const ids = await ctx.runQuery(internal.loopsState.pending, {
				now: Date.now(),
			});
			const deadline = Date.now() + 3 * 60_000;
			for (const id of ids) {
				if (Date.now() > deadline) break;
				counts[
					await syncStudent(
						ctx,
						id,
						client,
						env.LOOPS_STUDENT_LIST_ID,
						runId,
						dryRun,
					)
				]++;
			}
		} catch (caught) {
			error = caught instanceof LoopsFailure ? caught.category : "unavailable";
			if (caught instanceof LoopsFailure && caught.retryAfterMs !== undefined)
				retryAt = Date.now() + caught.retryAfterMs;
		} finally {
			await ctx.runMutation(internal.loopsState.end, { runId, error, retryAt });
		}
		if (error || counts.failed)
			console.warn("Loops student sync needs attention", {
				error,
				failed: counts.failed,
			});
		return {
			status:
				error || counts.failed ? ("failed" as const) : ("complete" as const),
			...counts,
			error,
		};
	},
});
