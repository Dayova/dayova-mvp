import type { MutationCtx, QueryCtx } from "./_generated/server";

export const getClerkIdentity = (
	ctx: QueryCtx | MutationCtx,
	tokenIdentifier: string,
) =>
	ctx.db
		.query("clerkIdentities")
		.withIndex("by_tokenIdentifier", (q) =>
			q.eq("tokenIdentifier", tokenIdentifier),
		)
		.unique();

// A deleted Clerk ID is never reused. Keep only the minimal replay/access barrier;
// names, email and event payloads are removed from it on deletion.
export async function markClerkIdentityDeleted(
	ctx: MutationCtx,
	tokenIdentifier: string,
	clerkId: string,
	deletedAt: number,
) {
	const existing = await getClerkIdentity(ctx, tokenIdentifier);
	if (existing?.deletedAt !== undefined) return existing.deletedAt;
	const value = {
		tokenIdentifier,
		clerkId,
		updatedAt: deletedAt,
		eventAt: deletedAt,
		deletedAt,
		verifiedEmail: undefined,
	};
	if (existing) await ctx.db.patch("clerkIdentities", existing._id, value);
	else await ctx.db.insert("clerkIdentities", value);
	return deletedAt;
}
