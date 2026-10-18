import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	env,
	internalMutation,
	internalQuery,
	type MutationCtx,
} from "./_generated/server";
import { type CrmError, crmError } from "./crmContract";

export async function enqueueCrmUpdate(ctx: MutationCtx, userId: Id<"users">) {
	if (env.NOTION_CRM_MODE !== "live") return;
	const existing = await ctx.db
		.query("crmStudentUpdates")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.unique();
	const now = Date.now();
	if (existing) {
		await ctx.db.patch("crmStudentUpdates", existing._id, {
			revision: existing.revision + 1,
			status: "pending",
			nextAttemptAt: now,
			attempts: 0,
			error: undefined,
		});
	} else {
		await ctx.db.insert("crmStudentUpdates", {
			userId,
			revision: 1,
			status: "pending",
			nextAttemptAt: now,
			attempts: 0,
		});
	}
	if (!existing || existing.status === "review" || existing.nextAttemptAt > now)
		await ctx.scheduler.runAfter(0, internal.crmSync.reconcile, {
			updatesOnly: true,
		});
}

export const due = internalQuery({
	args: { now: v.number() },
	returns: v.array(
		v.object({
			updateId: v.id("crmStudentUpdates"),
			userId: v.id("users"),
			revision: v.number(),
		}),
	),
	handler: async (ctx, { now }) =>
		(
			await ctx.db
				.query("crmStudentUpdates")
				.withIndex("by_status_and_nextAttemptAt", (q) =>
					q.eq("status", "pending").lte("nextAttemptAt", now),
				)
				.take(20)
		).map((row) => ({
			updateId: row._id,
			userId: row.userId,
			revision: row.revision,
		})),
});

export const target = internalQuery({
	args: { userId: v.id("users") },
	returns: v.union(
		v.null(),
		v.object({
			clerkId: v.string(),
			linkedPageId: v.optional(v.string()),
			conflict: v.boolean(),
		}),
	),
	handler: async (ctx, { userId }) => {
		const user = await ctx.db.get("users", userId);
		if (!user) return null;
		const links = await ctx.db
			.query("crmStudentLinks")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.take(2);
		return {
			clerkId: user.clerkId,
			linkedPageId: links[0]?.pageId,
			conflict: links.length > 1 || !user.clerkId,
		};
	},
});

export const finish = internalMutation({
	args: {
		updateId: v.id("crmStudentUpdates"),
		revision: v.number(),
		error: v.optional(crmError),
	},
	returns: v.boolean(),
	handler: async (ctx, { updateId, revision, error }) => {
		const row = await ctx.db.get("crmStudentUpdates", updateId);
		if (!row || row.revision !== revision) return false;
		if (!error) {
			await ctx.db.delete("crmStudentUpdates", updateId);
			return true;
		}
		const attempts = row.attempts + 1;
		await ctx.db.patch("crmStudentUpdates", updateId, {
			status: error === "identity_changed" ? "review" : "pending",
			nextAttemptAt:
				error === "identity_changed"
					? row.nextAttemptAt
					: Date.now() +
						Math.min(60 * 60_000, 1000 * 2 ** Math.min(attempts, 10)),
			attempts,
			error: error as CrmError,
		});
		return true;
	},
});
