import { v } from "convex/values";
import { env, internalMutation, internalQuery } from "./_generated/server";
import { crmError } from "./crmContract";

export const pending = internalQuery({
	args: {},
	returns: v.array(v.id("crmStudentSignups")),
	handler: async (ctx) =>
		(
			await ctx.db
				.query("crmStudentSignups")
				.withIndex("by_status", (q) => q.eq("status", "pending"))
				.take(20)
		).map((row) => row._id),
});

export const inspect = internalQuery({
	args: { signupId: v.id("crmStudentSignups") },
	returns: v.union(
		v.null(),
		v.object({
			userId: v.id("users"),
			clerkId: v.string(),
			email: v.string(),
			name: v.string(),
			linkedPageId: v.optional(v.string()),
			attemptedAt: v.optional(v.number()),
			dataSourceId: v.optional(v.string()),
			conflict: v.boolean(),
		}),
	),
	handler: async (ctx, { signupId }) => {
		const signup = await ctx.db.get("crmStudentSignups", signupId);
		if (!signup || signup.status !== "pending") return null;
		const user = await ctx.db.get("users", signup.userId);
		if (!user) return null;
		const users = await ctx.db
			.query("users")
			.withIndex("by_clerkId", (q) => q.eq("clerkId", user.clerkId))
			.take(2);
		const links = await ctx.db
			.query("crmStudentLinks")
			.withIndex("by_userId", (q) => q.eq("userId", user._id))
			.take(2);
		return {
			userId: user._id,
			clerkId: user.clerkId,
			email: user.email,
			name: user.name ?? "",
			linkedPageId: links[0]?.pageId,
			attemptedAt: signup.attemptedAt,
			dataSourceId: signup.dataSourceId,
			conflict:
				users.length !== 1 || links.length > 1 || !user.clerkId || !user.email,
		};
	},
});

export const markAttempt = internalMutation({
	args: {
		signupId: v.id("crmStudentSignups"),
		runId: v.string(),
		dataSourceId: v.string(),
		clerkId: v.string(),
		email: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const state = await ctx.db
			.query("crmSyncState")
			.withIndex("by_key", (q) => q.eq("key", "students"))
			.unique();
		if (
			env.NOTION_CRM_MODE !== "live" ||
			!state?.running ||
			state.mode !== "live" ||
			state.runId !== args.runId ||
			state.dataSourceId !== args.dataSourceId
		)
			return false;
		const signup = await ctx.db.get("crmStudentSignups", args.signupId);
		if (
			!signup ||
			signup.status !== "pending" ||
			signup.attemptedAt !== undefined
		)
			return false;
		const user = await ctx.db.get("users", signup.userId);
		if (!user || user.clerkId !== args.clerkId || user.email !== args.email)
			return false;
		const users = await ctx.db
			.query("users")
			.withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
			.take(2);
		const links = await ctx.db
			.query("crmStudentLinks")
			.withIndex("by_userId", (q) => q.eq("userId", user._id))
			.take(1);
		if (users.length !== 1 || links.length) return false;
		await ctx.db.patch("crmStudentSignups", signup._id, {
			attemptedAt: Date.now(),
			dataSourceId: args.dataSourceId,
		});
		return true;
	},
});

export const finish = internalMutation({
	args: { signupId: v.id("crmStudentSignups"), error: v.optional(crmError) },
	returns: v.null(),
	handler: async (ctx, { signupId, error }) => {
		const row = await ctx.db.get("crmStudentSignups", signupId);
		if (!row) return null;
		if (error)
			await ctx.db.patch("crmStudentSignups", signupId, {
				status: "review",
				error,
			});
		else await ctx.db.delete("crmStudentSignups", signupId);
		return null;
	},
});
