import { type Infer, v } from "convex/values";

export const crmError = v.union(
	v.literal("configuration"),
	v.literal("schema"),
	v.literal("unauthorized"),
	v.literal("unavailable"),
	v.literal("rate_limited"),
	v.literal("identity_changed"),
	v.literal("capacity"),
	v.literal("timeout"),
	v.literal("internal"),
);
export type CrmError = Infer<typeof crmError>;
export const crmCounts = v.object({
	// Optional for aggregate status rows written before signup provisioning existed.
	created: v.optional(v.number()),
	wouldCreate: v.optional(v.number()),
	creationReview: v.optional(v.number()),
	total: v.number(),
	matched: v.number(),
	unmatched: v.number(),
	conflict: v.number(),
	proposed: v.number(),
	paidWithoutEntitlement: v.number(),
	paidWithoutCrm: v.number(),
	synced: v.number(),
	failed: v.number(),
});
export type CrmCounts = Infer<typeof crmCounts>;
export const emptyCounts = (): CrmCounts => ({
	total: 0,
	matched: 0,
	unmatched: 0,
	conflict: 0,
	proposed: 0,
	paidWithoutEntitlement: 0,
	paidWithoutCrm: 0,
	synced: 0,
	failed: 0,
});
export const crmProjection = v.object({
	userId: v.id("users"),
	registeredAt: v.number(),
	profile: v.object({
		name: v.optional(v.string()),
		grade: v.optional(v.string()),
		state: v.optional(v.string()),
		schoolType: v.optional(v.string()),
	}),
	state: v.union(
		v.literal("none"),
		v.literal("trial"),
		v.literal("paid"),
		v.literal("billing grace"),
		v.literal("expired"),
	),
	product: v.union(v.string(), v.null()),
	paymentStatus: v.union(
		v.literal("None"),
		v.literal("Trial"),
		v.literal("Paid"),
		v.literal("Overdue"),
		v.literal("Expired"),
		v.literal("Unknown"),
	),
	subscriptionPlan: v.union(
		v.literal("None"),
		v.literal("Monthly"),
		v.literal("Annual"),
		v.literal("Unknown"),
	),
	store: v.union(v.string(), v.null()),
	expiresAt: v.union(v.number(), v.null()),
	graceExpiresAt: v.union(v.number(), v.null()),
	trialStartedAt: v.union(v.number(), v.null()),
	trialExpiresAt: v.union(v.number(), v.null()),
	willRenew: v.boolean(),
});
export type CrmProjection = Infer<typeof crmProjection>;
export const crmMatch = v.union(
	v.object({ status: v.literal("matched"), projection: crmProjection }),
	v.object({
		status: v.union(
			v.literal("unmatched"),
			v.literal("proposed"),
			v.literal("conflict"),
		),
	}),
);
export type CrmMatch = Infer<typeof crmMatch>;
