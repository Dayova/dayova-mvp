import { v } from "convex/values";

export const LOOPS_STUDENT_LIST_ID = "cmucp5ftscjij0jyh2p78ed9y";
export const loopsError = v.union(
	v.literal("configuration"),
	v.literal("unavailable"),
	v.literal("rate_limited"),
	v.literal("unauthorized"),
	v.literal("invalid_response"),
	v.literal("rejected"),
	v.literal("identity_conflict"),
	v.literal("email_changed"),
	v.literal("contact_missing"),
	v.literal("list_membership"),
	v.literal("uncertain_create"),
	v.literal("destination_changed"),
	v.literal("internal_account"),
);

export const loopsJobFields = {
	userId: v.id("users"),
	clerkId: v.string(),
	// Only populated from the authenticated identity, never updateProfile.email.
	accountEmail: v.optional(v.string()),
	version: v.number(),
	status: v.union(
		v.literal("pending"),
		v.literal("synced"),
		v.literal("review"),
	),
	nextAttemptAt: v.number(),
	attempts: v.number(),
	listId: v.optional(v.string()),
	contactId: v.optional(v.string()),
	createAttempted: v.optional(v.boolean()),
	deleted: v.optional(v.boolean()),
	lastSyncedAt: v.optional(v.number()),
	error: v.optional(loopsError),
};
export const loopsJob = v.object({
	_id: v.id("loopsStudents"),
	_creationTime: v.number(),
	...loopsJobFields,
});
