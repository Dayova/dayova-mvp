import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	users: defineTable({
		tokenIdentifier: v.string(),
		clerkId: v.string(),
		email: v.string(),
		name: v.optional(v.string()),
		phone: v.optional(v.string()),
		birthDate: v.optional(v.string()),
		avatarUrl: v.optional(v.string()),
	})
		.index("by_tokenIdentifier", ["tokenIdentifier"])
		.index("by_clerkId", ["clerkId"])
		.index("by_email", ["email"]),
	onboardingQuestions: defineTable({
		key: v.string(),
		prompt: v.string(),
		kind: v.union(v.literal("select"), v.literal("input")),
		order: v.number(),
		options: v.optional(v.array(v.string())),
	})
		.index("by_key", ["key"])
		.index("by_order", ["order"]),
	userOnboardingAnswers: defineTable({
		userId: v.id("users"),
		questionId: v.id("onboardingQuestions"),
		answer: v.string(),
	})
		.index("by_userId", ["userId"])
		.index("by_userId_and_questionId", ["userId", "questionId"]),
	dayEntries: defineTable({
		ownerTokenIdentifier: v.string(),
		dayKey: v.string(),
		title: v.string(),
		time: v.optional(v.string()),
		kind: v.optional(v.string()),
		notes: v.optional(v.string()),
		dueDateKey: v.optional(v.string()),
		dueDateLabel: v.optional(v.string()),
		plannedDateLabel: v.optional(v.string()),
		durationMinutes: v.optional(v.number()),
		examTypeLabel: v.optional(v.string()),
	}).index("by_ownerTokenIdentifier_and_dayKey", [
		"ownerTokenIdentifier",
		"dayKey",
	]),
});
