import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const getPaidThrough = (entitlement: {
	subscriptionExpiresAt?: number;
	subscriptionGraceExpiresAt?: number;
}) => {
	const accessDates = [
		entitlement.subscriptionExpiresAt,
		entitlement.subscriptionGraceExpiresAt,
	].filter((value): value is number => value !== undefined);
	return accessDates.length > 0
		? Math.max(...accessDates)
		: Number.POSITIVE_INFINITY;
};

/**
 * Operational migration for the October 2026 evaluation extension.
 *
 * It intentionally updates only accounts that are already blocked by an
 * expired trial. Store subscriptions remain the source of truth for paid
 * access and are never changed here. Each transaction processes at most 100
 * records; the return count describes this batch, not scheduled continuations.
 * Retrying from the beginning is safe: already extended records are skipped.
 */
export const extendExpiredTrials = internalMutation({
	args: {
		expiresAt: v.number(),
		cursor: v.optional(v.string()),
		cutoff: v.optional(v.number()),
	},
	returns: v.object({
		extendedCount: v.number(),
		continuationScheduled: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const now = Date.now();
		if (!Number.isFinite(args.expiresAt) || args.expiresAt <= now) {
			throw new Error("Trial expiry must be a finite future timestamp");
		}
		const cutoff = args.cutoff ?? now;
		if (!Number.isFinite(cutoff) || cutoff > now) {
			throw new Error("Trial cutoff must not be in the future");
		}
		const page = await ctx.db
			.query("accessEntitlements")
			.withIndex("by_creation_time")
			.paginate({
				cursor: args.cursor ?? null,
				numItems: 100,
				maximumRowsRead: 100,
				maximumBytesRead: 1_000_000,
			});
		let extendedCount = 0;

		for (const entitlement of page.page) {
			const hasActivePaidAccess =
				entitlement.revenueCatEntitlementActive === true &&
				now < getPaidThrough(entitlement);
			if (
				hasActivePaidAccess ||
				entitlement.trialExpiresAt === undefined ||
				entitlement.trialExpiresAt > cutoff ||
				entitlement.trialExpiresAt >= args.expiresAt
			) {
				continue;
			}

			await ctx.db.patch("accessEntitlements", entitlement._id, {
				trialExpiresAt: args.expiresAt,
				updatedAt: now,
			});
			extendedCount += 1;
		}

		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.entitlementAdmin.extendExpiredTrials,
				{
					expiresAt: args.expiresAt,
					cutoff,
					cursor: page.continueCursor,
				},
			);
		}
		return { extendedCount, continuationScheduled: !page.isDone };
	},
});
