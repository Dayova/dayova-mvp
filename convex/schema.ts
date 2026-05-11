import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const planQuestionValidator = v.object({
	id: v.string(),
	prompt: v.string(),
	targetInsight: v.string(),
});

const planInsightValidator = v.object({
	summary: v.string(),
	strengths: v.array(v.string()),
	gaps: v.array(v.string()),
});

export default defineSchema({
	users: defineTable({
		tokenIdentifier: v.string(),
		clerkId: v.string(),
		email: v.string(),
		name: v.optional(v.string()),
		phone: v.optional(v.string()),
		birthDate: v.optional(v.string()),
		grade: v.optional(v.string()),
		schoolType: v.optional(v.string()),
		state: v.optional(v.string()),
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
		completed: v.optional(v.boolean()),
		relatedLearningPlanId: v.optional(v.id("learningPlans")),
		relatedLearningPlanSessionId: v.optional(v.id("learningPlanSessions")),
	}).index("by_ownerTokenIdentifier_and_dayKey", [
		"ownerTokenIdentifier",
		"dayKey",
	]),
	learningPlans: defineTable({
		ownerTokenIdentifier: v.string(),
		subject: v.string(),
		examTypeLabel: v.string(),
		examDateKey: v.string(),
		examDateLabel: v.string(),
		examTime: v.string(),
		durationMinutes: v.number(),
		topicDescription: v.string(),
		notes: v.optional(v.string()),
		status: v.union(
			v.literal("draft"),
			v.literal("questionsReady"),
			v.literal("generated"),
			v.literal("accepted"),
		),
		knowledgeQuestions: v.optional(v.array(planQuestionValidator)),
		knowledgeAnswersJson: v.optional(v.string()),
		sourceSummary: v.optional(v.string()),
		insight: v.optional(planInsightValidator),
		examDayEntryId: v.optional(v.id("dayEntries")),
		acceptedAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_ownerTokenIdentifier", ["ownerTokenIdentifier"])
		.index("by_ownerTokenIdentifier_and_status", [
			"ownerTokenIdentifier",
			"status",
		]),
	learningPlanDocuments: defineTable({
		ownerTokenIdentifier: v.string(),
		learningPlanId: v.id("learningPlans"),
		storageId: v.string(),
		storageProvider: v.union(v.literal("convex"), v.literal("r2")),
		fileName: v.string(),
		fileType: v.string(),
		fileSizeBytes: v.number(),
		createdAt: v.number(),
	})
		.index("by_learningPlanId", ["learningPlanId"])
		.index("by_ownerTokenIdentifier", ["ownerTokenIdentifier"]),
	learningPlanAnswers: defineTable({
		ownerTokenIdentifier: v.string(),
		learningPlanId: v.id("learningPlans"),
		questionId: v.string(),
		answer: v.string(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_learningPlanId", ["learningPlanId"])
		.index("by_learningPlanId_and_questionId", ["learningPlanId", "questionId"])
		.index("by_ownerTokenIdentifier", ["ownerTokenIdentifier"]),
	learningPlanSessions: defineTable({
		ownerTokenIdentifier: v.string(),
		learningPlanId: v.id("learningPlans"),
		phase: v.union(
			v.literal("theory"),
			v.literal("practice"),
			v.literal("rehearsal"),
		),
		title: v.string(),
		dateKey: v.string(),
		dateLabel: v.string(),
		startTime: v.string(),
		durationMinutes: v.number(),
		goal: v.string(),
		tasks: v.array(v.string()),
		expectedOutcome: v.string(),
		completed: v.optional(v.boolean()),
		sortOrder: v.number(),
		dayEntryId: v.optional(v.id("dayEntries")),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_learningPlanId_and_sortOrder", ["learningPlanId", "sortOrder"])
		.index("by_ownerTokenIdentifier", ["ownerTokenIdentifier"]),
});
