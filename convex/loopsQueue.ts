import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { env, type MutationCtx } from "./_generated/server";

async function wake(ctx: MutationCtx) {
	if (env.LOOPS_MODE === "live")
		await ctx.scheduler.runAfter(0, internal.loopsSync.reconcile, {});
}

export async function queueLoopsStudent(
	ctx: MutationCtx,
	userId: Id<"users">,
	options: { signup?: boolean; accountEmail?: string; nameChanged?: boolean },
) {
	const row = await ctx.db
		.query("loopsStudents")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.unique();
	if (!row) {
		// Signing in to an old account must not become an implicit bulk import.
		if (!options.signup || !options.accountEmail) return;
		const user = await ctx.db.get("users", userId);
		if (!user || user.validationRole === "founder") return;
		await ctx.db.insert("loopsStudents", {
			userId,
			clerkId: user.clerkId,
			accountEmail: options.accountEmail,
			version: 1,
			status: "pending",
			nextAttemptAt: Date.now(),
			attempts: 0,
		});
	} else {
		if (row.deleted) return;
		if (
			!options.nameChanged &&
			(!options.accountEmail || options.accountEmail === row.accountEmail)
		)
			return;
		await ctx.db.patch("loopsStudents", row._id, {
			...(options.accountEmail ? { accountEmail: options.accountEmail } : {}),
			version: row.version + 1,
			status: row.status === "review" ? "review" : "pending",
			nextAttemptAt: Date.now(),
		});
	}
	await wake(ctx);
}

export async function deleteLoopsStudent(ctx: MutationCtx, user: Doc<"users">) {
	const row = await ctx.db
		.query("loopsStudents")
		.withIndex("by_userId", (q) => q.eq("userId", user._id))
		.unique();
	if (!row || row.deleted) return;
	if (!row.listId) {
		await ctx.db.delete("loopsStudents", row._id);
		return;
	}
	// Keep only opaque IDs until the independent processor confirms deletion.
	await ctx.db.patch("loopsStudents", row._id, {
		deleted: true,
		accountEmail: undefined,
		version: row.version + 1,
		status: "pending",
		error: undefined,
		nextAttemptAt: Date.now(),
		attempts: 0,
	});
	await wake(ctx);
}
