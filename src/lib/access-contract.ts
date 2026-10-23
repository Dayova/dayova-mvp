import { type Infer, v } from "convex/values";

const metadata = v.object({
	trialStartedAt: v.optional(v.number()),
	trialExpiresAt: v.optional(v.number()),
	reminderAt: v.optional(v.number()),
	trialTermsVersion: v.optional(v.string()),
	subscriptionExpiresAt: v.optional(v.number()),
	subscriptionGraceExpiresAt: v.optional(v.number()),
	managementUrl: v.optional(v.string()),
	productId: v.optional(v.string()),
	store: v.optional(v.string()),
	willRenew: v.optional(v.boolean()),
});
/** One wire contract for backend validation and client access decisions. */
export const accessSnapshotValidator = v.union(
	metadata.extend({
		state: v.literal("needsActivation"),
		canUseApp: v.literal(false),
	}),
	metadata.extend({ state: v.literal("expired"), canUseApp: v.literal(false) }),
	metadata.extend({
		state: v.literal("trial"),
		canUseApp: v.literal(true),
		trialExpiresAt: v.number(),
	}),
	metadata.extend({ state: v.literal("paid"), canUseApp: v.literal(true) }),
	metadata.extend({
		state: v.literal("billingGrace"),
		canUseApp: v.literal(true),
		subscriptionGraceExpiresAt: v.number(),
	}),
);
export type AccessSnapshot = Infer<typeof accessSnapshotValidator>;
export type AccessState = AccessSnapshot["state"];
