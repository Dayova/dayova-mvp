import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { loopsError, loopsJob } from "./loopsContract";

export const begin = internalMutation({
	args: { runId: v.string() },
	returns: v.boolean(),
	handler: async (ctx, { runId }) => {
		const row = await ctx.db
			.query("loopsWorker")
			.withIndex("by_key", (q) => q.eq("key", "students"))
			.unique();
		const now = Date.now();
		if (row && (row.leaseUntil > now || (row.retryAt ?? 0) > now)) return false;
		const value = { key: "students", runId, leaseUntil: now + 11 * 60_000 };
		if (row) await ctx.db.patch("loopsWorker", row._id, value);
		else await ctx.db.insert("loopsWorker", value);
		return true;
	},
});

export const end = internalMutation({
	args: {
		runId: v.string(),
		error: v.optional(loopsError),
		retryAt: v.optional(v.number()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const row = await ctx.db
			.query("loopsWorker")
			.withIndex("by_key", (q) => q.eq("key", "students"))
			.unique();
		if (row?.runId === args.runId)
			await ctx.db.patch("loopsWorker", row._id, {
				leaseUntil: 0,
				finishedAt: Date.now(),
				error: args.error,
				retryAt: args.retryAt,
			});
		return null;
	},
});

export const pending = internalQuery({
	args: { now: v.number() },
	returns: v.array(v.id("loopsStudents")),
	handler: async (ctx, { now }) =>
		(
			await ctx.db
				.query("loopsStudents")
				.withIndex("by_status_and_nextAttemptAt", (q) =>
					q.eq("status", "pending").lte("nextAttemptAt", now),
				)
				.take(20)
		).map((row) => row._id),
});

export const inspect = internalQuery({
	args: { id: v.id("loopsStudents") },
	returns: v.union(
		v.null(),
		v.object({
			job: loopsJob,
			name: v.optional(v.string()),
			valid: v.boolean(),
			founder: v.boolean(),
		}),
	),
	handler: async (ctx, { id }) => {
		const job = await ctx.db.get("loopsStudents", id);
		if (!job || job.status !== "pending") return null;
		const user = await ctx.db.get("users", job.userId);
		const matches = await ctx.db
			.query("users")
			.withIndex("by_clerkId", (q) => q.eq("clerkId", job.clerkId))
			.take(2);
		return {
			job,
			name: user?.name,
			valid: !!user && user.clerkId === job.clerkId && matches.length === 1,
			founder: user?.validationRole === "founder",
		};
	},
});

export const prepare = internalMutation({
	args: {
		id: v.id("loopsStudents"),
		version: v.number(),
		listId: v.string(),
		create: v.boolean(),
		runId: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const worker = await ctx.db
			.query("loopsWorker")
			.withIndex("by_key", (q) => q.eq("key", "students"))
			.unique();
		const job = await ctx.db.get("loopsStudents", args.id);
		if (
			worker?.runId !== args.runId ||
			worker.leaseUntil <= Date.now() ||
			!job ||
			job.deleted ||
			job.status !== "pending" ||
			job.version !== args.version ||
			(job.listId && job.listId !== args.listId)
		)
			return false;
		const user = await ctx.db.get("users", job.userId);
		const matches = await ctx.db
			.query("users")
			.withIndex("by_clerkId", (q) => q.eq("clerkId", job.clerkId))
			.take(2);
		if (
			!user ||
			matches.length !== 1 ||
			user.clerkId !== job.clerkId ||
			user.validationRole === "founder"
		)
			return false;
		await ctx.db.patch("loopsStudents", job._id, {
			listId: args.listId,
			...(args.create ? { createAttempted: true } : {}),
		});
		return true;
	},
});

export const finish = internalMutation({
	args: {
		id: v.id("loopsStudents"),
		version: v.number(),
		contactId: v.optional(v.string()),
		error: v.optional(loopsError),
		retryAt: v.optional(v.number()),
		deleted: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const job = await ctx.db.get("loopsStudents", args.id);
		if (!job) return null;
		if (
			args.deleted &&
			!args.error &&
			job.deleted &&
			job.version === args.version
		) {
			await ctx.db.delete("loopsStudents", job._id);
			return null;
		}
		// A concurrent profile save/deletion remains pending after the older request.
		if (job.version !== args.version) {
			if (args.contactId)
				await ctx.db.patch("loopsStudents", job._id, {
					contactId: args.contactId,
				});
			return null;
		}
		await ctx.db.patch("loopsStudents", job._id, {
			...(args.contactId ? { contactId: args.contactId } : {}),
			status: args.error
				? args.retryAt === undefined
					? "review"
					: "pending"
				: "synced",
			error: args.error,
			attempts: args.error ? job.attempts + 1 : 0,
			nextAttemptAt: args.retryAt ?? Date.now(),
			...(args.error ? {} : { lastSyncedAt: Date.now() }),
		});
		return null;
	},
});

export const retry = internalMutation({
	args: { id: v.id("loopsStudents") },
	returns: v.null(),
	handler: async (ctx, { id }) => {
		const job = await ctx.db.get("loopsStudents", id);
		if (job)
			await ctx.db.patch("loopsStudents", id, {
				status: "pending",
				error: undefined,
				nextAttemptAt: Date.now(),
			});
		return null;
	},
});

export const status = internalQuery({
	args: {},
	returns: v.object({
		pending: v.number(),
		review: v.number(),
		countsCapped: v.boolean(),
		leaseUntil: v.number(),
		finishedAt: v.optional(v.number()),
		error: v.optional(loopsError),
	}),
	handler: async (ctx) => {
		const pending = await ctx.db
			.query("loopsStudents")
			.withIndex("by_status_and_nextAttemptAt", (q) =>
				q.eq("status", "pending"),
			)
			.take(101);
		const review = await ctx.db
			.query("loopsStudents")
			.withIndex("by_status_and_nextAttemptAt", (q) => q.eq("status", "review"))
			.take(101);
		const worker = await ctx.db
			.query("loopsWorker")
			.withIndex("by_key", (q) => q.eq("key", "students"))
			.unique();
		return {
			pending: pending.length,
			review: review.length,
			countsCapped: pending.length === 101 || review.length === 101,
			leaseUntil: worker?.leaseUntil ?? 0,
			finishedAt: worker?.finishedAt,
			error: worker?.error,
		};
	},
});
