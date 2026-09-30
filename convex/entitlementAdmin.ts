import { v } from "convex/values";
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
 * access and are never changed here.
 */
export const extendExpiredTrials = internalMutation({
	args: {
		expiresAt: v.number(),
	},
	returns: v.object({ extendedCount: v.number() }),
	handler: async (ctx, args) => {
		const now = Date.now();
		const entitlements = await ctx.db.query("accessEntitlements").collect();
		let extendedCount = 0;

		for (const entitlement of entitlements) {
			const hasActivePaidAccess =
				entitlement.revenueCatEntitlementActive === true &&
				now < getPaidThrough(entitlement);
			if (
				hasActivePaidAccess ||
				entitlement.trialExpiresAt === undefined ||
				entitlement.trialExpiresAt > now
			) {
				continue;
			}

			await ctx.db.patch("accessEntitlements", entitlement._id, {
				trialExpiresAt: args.expiresAt,
				updatedAt: now,
			});
			extendedCount += 1;
		}

		return { extendedCount };
	},
});
