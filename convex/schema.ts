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

const sessionPhaseValidator = v.union(
	v.literal("theory"),
	v.literal("practice"),
	v.literal("rehearsal"),
);

const sessionContentItemKindValidator = v.union(
	v.literal("learnCard"),
	v.literal("multipleChoice"),
	v.literal("written"),
	v.literal("voice"),
);

const answerRatingValidator = v.union(
	v.literal("notCorrect"),
	v.literal("partiallyCorrect"),
	v.literal("correct"),
);

const sessionContentChoiceValidator = v.object({
	id: v.string(),
	text: v.string(),
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
		validationStudentCode: v.optional(v.string()),
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
	userLearningTimes: defineTable({
		ownerTokenIdentifier: v.string(),
		dayOfWeek: v.number(),
		startTime: v.string(),
		endTime: v.string(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_ownerTokenIdentifier", ["ownerTokenIdentifier"])
		.index("by_ownerTokenIdentifier_and_dayOfWeek", [
			"ownerTokenIdentifier",
			"dayOfWeek",
		]),
	notificationPreferences: defineTable({
		ownerTokenIdentifier: v.string(),
		systemNotificationsEnabled: v.boolean(),
		dailyBriefingEnabled: v.boolean(),
		dailyBriefingTime: v.string(),
		beforeExamEnabled: v.boolean(),
		beforeLearningTimeEnabled: v.boolean(),
		beforeHomeworkWorkEnabled: v.boolean(),
		beforeHomeworkDueEnabled: v.boolean(),
		reminderOffsetMinutes: v.number(),
		forgottenEventEnabled: v.boolean(),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_ownerTokenIdentifier", ["ownerTokenIdentifier"]),
	localNotificationSchedules: defineTable({
		ownerTokenIdentifier: v.string(),
		fingerprint: v.string(),
		eventKey: v.string(),
		category: v.union(
			v.literal("learningPlan"),
			v.literal("task"),
			v.literal("message"),
		),
		type: v.union(
			v.literal("dailyBriefing"),
			v.literal("beforeEvent"),
			v.literal("forgottenEvent"),
		),
		title: v.string(),
		body: v.string(),
		relatedDayEntryId: v.optional(v.id("dayEntries")),
		relatedLearningPlanId: v.optional(v.id("learningPlans")),
		relatedLearningPlanSessionId: v.optional(v.id("learningPlanSessions")),
		scheduledFor: v.number(),
		expiresAt: v.number(),
		createdAt: v.number(),
	})
		.index("by_ownerTokenIdentifier_and_fingerprint", [
			"ownerTokenIdentifier",
			"fingerprint",
		])
		.index("by_ownerTokenIdentifier_and_expiresAt", [
			"ownerTokenIdentifier",
			"expiresAt",
		]),
	notificationHistory: defineTable({
		ownerTokenIdentifier: v.string(),
		eventKey: v.string(),
		category: v.union(
			v.literal("learningPlan"),
			v.literal("task"),
			v.literal("message"),
		),
		type: v.union(
			v.literal("dailyBriefing"),
			v.literal("beforeEvent"),
			v.literal("forgottenEvent"),
		),
		title: v.string(),
		body: v.string(),
		relatedDayEntryId: v.optional(v.id("dayEntries")),
		relatedLearningPlanId: v.optional(v.id("learningPlans")),
		relatedLearningPlanSessionId: v.optional(v.id("learningPlanSessions")),
		triggeredAt: v.number(),
		readAt: v.optional(v.number()),
		deletedAt: v.optional(v.number()),
		createdAt: v.number(),
	})
		.index("by_ownerTokenIdentifier_and_createdAt", [
			"ownerTokenIdentifier",
			"createdAt",
		])
		.index("by_ownerTokenIdentifier_and_eventKey", [
			"ownerTokenIdentifier",
			"eventKey",
		]),
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
		executionStatus: v.optional(v.string()),
		relatedLearningPlanId: v.optional(v.id("learningPlans")),
		relatedLearningPlanSessionId: v.optional(v.id("learningPlanSessions")),
	})
		.index("by_ownerTokenIdentifier", ["ownerTokenIdentifier"])
		.index("by_ownerTokenIdentifier_and_dayKey", [
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
		planningHint: v.optional(v.string()),
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
		phase: sessionPhaseValidator,
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
	learningSessionContentItems: defineTable({
		ownerTokenIdentifier: v.string(),
		learningPlanId: v.id("learningPlans"),
		sessionId: v.id("learningPlanSessions"),
		phase: sessionPhaseValidator,
		kind: sessionContentItemKindValidator,
		title: v.string(),
		prompt: v.string(),
		front: v.optional(v.string()),
		back: v.optional(v.string()),
		explanation: v.string(),
		idealAnswer: v.string(),
		choices: v.optional(v.array(sessionContentChoiceValidator)),
		correctChoiceId: v.optional(v.string()),
		evaluationKeywords: v.array(v.string()),
		sortOrder: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_sessionId_and_sortOrder", ["sessionId", "sortOrder"])
		.index("by_ownerTokenIdentifier", ["ownerTokenIdentifier"]),
	learningSessionAnswerAttempts: defineTable({
		ownerTokenIdentifier: v.string(),
		learningPlanId: v.id("learningPlans"),
		sessionId: v.id("learningPlanSessions"),
		itemId: v.id("learningSessionContentItems"),
		selectedChoiceId: v.optional(v.string()),
		answerText: v.optional(v.string()),
		transcript: v.optional(v.string()),
		rating: answerRatingValidator,
		feedback: v.string(),
		perfectAnswer: v.string(),
		timeSpentSeconds: v.optional(v.number()),
		createdAt: v.number(),
	})
		.index("by_sessionId_and_createdAt", ["sessionId", "createdAt"])
		.index("by_itemId_and_createdAt", ["itemId", "createdAt"])
		.index("by_ownerTokenIdentifier", ["ownerTokenIdentifier"]),
	learningSessionAnalyses: defineTable({
		ownerTokenIdentifier: v.string(),
		learningPlanId: v.id("learningPlans"),
		sessionId: v.id("learningPlanSessions"),
		strengths: v.array(v.string()),
		gaps: v.array(v.string()),
		recommendation: v.string(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_sessionId", ["sessionId"])
		.index("by_ownerTokenIdentifier", ["ownerTokenIdentifier"]),
});
