import {
	paginationOptsValidator,
	paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	type QueryCtx,
} from "./_generated/server";
import {
	type CrmMatch,
	type CrmProjection,
	crmCounts,
	crmError,
	crmMatch,
	emptyCounts,
} from "./crmContract";
import { getCurrentAccess } from "./entitlements";

async function project(
	ctx: QueryCtx,
	user: Doc<"users">,
	now: number,
): Promise<CrmProjection | null> {
	const rows = await ctx.db
		.query("accessEntitlements")
		.withIndex("by_ownerTokenIdentifier", (q) =>
			q.eq("ownerTokenIdentifier", user.tokenIdentifier),
		)
		.take(2);
	if (rows.length > 1) return null;
	const entitlement = rows[0];
	if (entitlement && entitlement.userId !== user._id) return null;
	// A legacy/manual active flag is not evidence of a verified provider snapshot.
	if (
		entitlement?.revenueCatEntitlementActive &&
		entitlement.subscriptionVerifiedAt === undefined
	)
		return null;
	const access = entitlement ? getCurrentAccess(entitlement, now) : null;
	return {
		userId: user._id,
		state:
			access?.state === "billingGrace"
				? "billing grace"
				: (access?.state ?? "none"),
		product: entitlement?.subscriptionProductId ?? null,
		store: entitlement?.subscriptionStore ?? null,
		expiresAt: entitlement?.subscriptionExpiresAt ?? null,
		graceExpiresAt: entitlement?.subscriptionGraceExpiresAt ?? null,
		trialStartedAt: entitlement?.trialStartedAt ?? null,
		trialExpiresAt: entitlement?.trialExpiresAt ?? null,
		willRenew:
			entitlement?.revenueCatEntitlementActive === true &&
			entitlement.subscriptionWillRenew === true,
	};
}

export const inspectStudent = internalQuery({
	args: {
		pageId: v.string(),
		clerkId: v.string(),
		email: v.optional(v.string()),
		now: v.number(),
	},
	returns: crmMatch,
	handler: async (ctx, args): Promise<CrmMatch> => {
		if (!args.clerkId) {
			if (!args.email) return { status: "unmatched" };
			const candidates = await ctx.db
				.query("users")
				.withIndex("by_email", (q) => q.eq("email", args.email?.trim() ?? ""))
				.take(2);
			return {
				status:
					candidates.length === 1
						? "proposed"
						: candidates.length > 1
							? "conflict"
							: "unmatched",
			};
		}
		const users = await ctx.db
			.query("users")
			.withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
			.take(2);
		if (users.length !== 1)
			return { status: users.length ? "conflict" : "unmatched" };
		const user = users[0];
		const pageLinks = await ctx.db
			.query("crmStudentLinks")
			.withIndex("by_pageId", (q) => q.eq("pageId", args.pageId))
			.take(2);
		const userLinks = await ctx.db
			.query("crmStudentLinks")
			.withIndex("by_userId", (q) => q.eq("userId", user._id))
			.take(2);
		if (
			pageLinks.some((link) => link.userId !== user._id) ||
			userLinks.some((link) => link.pageId !== args.pageId) ||
			pageLinks.length > 1 ||
			userLinks.length > 1
		)
			return { status: "conflict" };
		const projection = await project(ctx, user, args.now);
		return projection
			? { status: "matched", projection }
			: { status: "conflict" };
	},
});

export const paidUsers = internalQuery({
	args: { paginationOpts: paginationOptsValidator, now: v.number() },
	returns: paginationResultValidator(
		v.object({ clerkId: v.string(), paid: v.boolean() }),
	),
	handler: async (ctx, args) => {
		const page = await ctx.db.query("users").paginate(args.paginationOpts);
		return {
			...page,
			page: await Promise.all(
				page.page.map(async (user) => {
					const projection = await project(ctx, user, args.now);
					return {
						clerkId: user.clerkId,
						paid:
							projection?.state === "paid" ||
							projection?.state === "billing grace",
					};
				}),
			),
		};
	},
});

export const begin = internalMutation({
	args: {
		runId: v.string(),
		dataSourceId: v.string(),
		mode: v.union(v.literal("dry-run"), v.literal("live")),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const state = await ctx.db
			.query("crmSyncState")
			.withIndex("by_key", (q) => q.eq("key", "students"))
			.unique();
		const now = Date.now();
		// Longer than Convex's 10-minute action limit: an expired worker cannot overlap its successor.
		if (state?.running && now < state.startedAt + 11 * 60_000) return false;
		if (
			args.mode === "live" &&
			(state?.dataSourceId !== args.dataSourceId ||
				(!state.lastSuccessAt &&
					(!state.dryRunAt || now - state.dryRunAt > 24 * 60 * 60_000)))
		)
			throw new Error(
				"CRM requires a successful dry run within 24 hours before enabling live sync.",
			);
		const value = {
			...args,
			key: "students",
			running: true,
			startedAt: now,
			counts: emptyCounts(),
			error: undefined,
			finishedAt: undefined,
			...(state?.dataSourceId !== args.dataSourceId
				? { dryRunAt: undefined, lastSuccessAt: undefined }
				: {}),
		};
		if (state) await ctx.db.patch("crmSyncState", state._id, value);
		else await ctx.db.insert("crmSyncState", value);
		return true;
	},
});

export const finish = internalMutation({
	args: { runId: v.string(), counts: crmCounts, error: v.optional(crmError) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const state = await ctx.db
			.query("crmSyncState")
			.withIndex("by_key", (q) => q.eq("key", "students"))
			.unique();
		if (!state || state.runId !== args.runId) return null;
		const now = Date.now();
		await ctx.db.patch("crmSyncState", state._id, {
			running: false,
			finishedAt: now,
			counts: args.counts,
			error: args.error,
			...(!args.error && state.mode === "dry-run" ? { dryRunAt: now } : {}),
			...(!args.error && state.mode === "live" && args.counts.failed === 0
				? { lastSuccessAt: now }
				: {}),
		});
		return null;
	},
});

export const recordLink = internalMutation({
	args: {
		pageId: v.string(),
		userId: v.id("users"),
		clerkId: v.string(),
		error: v.optional(crmError),
		syncedAt: v.optional(v.number()),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const users = await ctx.db
			.query("users")
			.withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
			.take(2);
		if (users.length !== 1 || users[0]._id !== args.userId) return false;
		const pages = await ctx.db
			.query("crmStudentLinks")
			.withIndex("by_pageId", (q) => q.eq("pageId", args.pageId))
			.take(2);
		const links = await ctx.db
			.query("crmStudentLinks")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.take(2);
		if (
			pages.length > 1 ||
			links.length > 1 ||
			pages.some((p) => p.userId !== args.userId) ||
			links.some((p) => p.pageId !== args.pageId)
		)
			return false;
		const value = {
			pageId: args.pageId,
			userId: args.userId,
			lastAttemptAt: Date.now(),
			error: args.error,
			...(args.syncedAt !== undefined ? { lastSyncedAt: args.syncedAt } : {}),
		};
		if (pages[0]) await ctx.db.patch("crmStudentLinks", pages[0]._id, value);
		// Failure reporting must not establish an unverified identity mapping.
		else if (args.error !== undefined) return false;
		else await ctx.db.insert("crmStudentLinks", value);
		return true;
	},
});

export const status = internalQuery({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			running: v.boolean(),
			startedAt: v.number(),
			finishedAt: v.optional(v.number()),
			lastSuccessAt: v.optional(v.number()),
			counts: crmCounts,
			error: v.optional(crmError),
		}),
	),
	handler: async (ctx) => {
		const row = await ctx.db
			.query("crmSyncState")
			.withIndex("by_key", (q) => q.eq("key", "students"))
			.unique();
		if (!row) return null;
		return {
			running: row.running,
			startedAt: row.startedAt,
			finishedAt: row.finishedAt,
			lastSuccessAt: row.lastSuccessAt,
			counts: row.counts,
			error: row.error,
		};
	},
});
