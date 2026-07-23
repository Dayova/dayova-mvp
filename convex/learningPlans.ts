import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	action,
	internalMutation,
	internalQuery,
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { getDayKeyQueryVariants } from "./dayKeyVariants";
import { deriveTopicReadiness } from "./diagnosticReadiness";
import { throwUserFacingError } from "./errors";
import {
	deleteManagedFile,
	getConfiguredStorageProvider,
	getR2ConfigOrThrow,
} from "./fileStorage";
import { normalizeGeneratedGermanText } from "./generatedGermanText";
import { MISSING_LEARNING_TIMES_HINT } from "./learningPlanPlanningHints";
import {
	getDefaultPreparationDepth,
	type PreparationDepth,
} from "./learningPreparationPolicy";
import { getLearningSessionComposition } from "./learningSessionComposition";
import { deleteSessionLearningDataForSession } from "./learningSessionContent";
import { alignSessionDurationReferences } from "./learningSessionDurationText";
import {
	learningTopicValidator,
	normalizeLearningTopics,
} from "./learningTopicMap";
import { assertNoScheduleConflict, isExamEntry } from "./scheduleConflicts";
import { assertMeaningfulTopicDescription } from "./topicDescriptionValidation";

const MAX_LEARNING_TIMES = 50;
// Convex Node actions have a 10-minute platform ceiling. Allow one extra minute
// before a later request may recover work left behind by a terminated action.
const STALE_CONTENT_GENERATION_MS = 11 * 60_000;

const phaseValidator = v.union(
	v.literal("theory"),
	v.literal("practice"),
	v.literal("rehearsal"),
);

const sessionCompositionVariantValidator = v.union(
	v.literal("control"),
	v.literal("split"),
);

const contentGenerationStatusValidator = v.union(
	v.literal("queued"),
	v.literal("generating"),
	v.literal("ready"),
	v.literal("failed"),
);

const preparationDepthValidator = v.union(
	v.literal("compact"),
	v.literal("thorough"),
	v.literal("intensive"),
);

const missedReasonValidator = v.union(
	v.literal("no_time"),
	v.literal("forgot"),
	v.literal("no_motivation"),
	v.literal("too_hard"),
	v.literal("too_big"),
	v.literal("unclear"),
	v.literal("other"),
);

const planQuestionValidator = v.object({
	id: v.string(),
	prompt: v.string(),
	targetInsight: v.string(),
	topicId: v.optional(v.string()),
	kind: v.optional(v.union(v.literal("performance"), v.literal("confidence"))),
	evaluationKeywords: v.optional(v.array(v.string())),
});

const planInsightValidator = v.object({
	summary: v.string(),
	strengths: v.array(v.string()),
	gaps: v.array(v.string()),
});

const generatedSessionValidator = v.object({
	phase: phaseValidator,
	title: v.string(),
	dateKey: v.string(),
	dateLabel: v.string(),
	startTime: v.string(),
	durationMinutes: v.number(),
	goal: v.string(),
	tasks: v.array(v.string()),
	expectedOutcome: v.string(),
});

type PublicDocument = {
	id: Id<"learningPlanDocuments">;
	fileName: string;
	fileType: string;
	fileSizeBytes: number;
};

type PublicAnswer = {
	id: Id<"learningPlanAnswers">;
	questionId: string;
	answer: string;
};

type PublicSession = {
	id: Id<"learningPlanSessions">;
	phase: "theory" | "practice" | "rehearsal";
	title: string;
	dateKey: string;
	dateLabel: string;
	startTime: string;
	durationMinutes: number;
	compositionVariant?: "control" | "split";
	goal: string;
	tasks: string[];
	expectedOutcome: string;
	contentGenerationStatus?: "queued" | "generating" | "ready" | "failed";
	contentGenerationError?: string;
	contentGeneratedAt?: number;
	completed: boolean;
	executionStatus:
		| "notStarted"
		| "started"
		| "completed"
		| "partiallyCompleted"
		| "missed"
		| "adjusted";
	startedAt?: number;
	outcomeAt?: number;
	missedReason?:
		| "no_time"
		| "forgot"
		| "no_motivation"
		| "too_hard"
		| "too_big"
		| "unclear"
		| "other";
	adjustedFromSessionId?: Id<"learningPlanSessions">;
	sortOrder: number;
};

const requireOwnerTokenIdentifier = async (ctx: QueryCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (identity === null) {
		throwUserFacingError("Nicht authentifiziert.");
	}

	return identity.tokenIdentifier;
};

const requireOwnerTokenIdentifierForMutation = async (ctx: MutationCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (identity === null) {
		throwUserFacingError("Nicht authentifiziert.");
	}

	return identity.tokenIdentifier;
};

type CreateLearningPlanArgs = {
	examDayEntryId: Id<"dayEntries">;
	subject: string;
	examTypeLabel: string;
	examDateKey: string;
	examDateLabel: string;
	examTime?: string;
	durationMinutes: number;
	topicDescription: string;
	notes?: string;
};

const createLearningPlan = async (
	ctx: MutationCtx,
	args: CreateLearningPlanArgs,
	options: { requireMeaningfulTopic: boolean },
) => {
	const ownerTokenIdentifier =
		await requireOwnerTokenIdentifierForMutation(ctx);
	const examEntry = await ctx.db.get("dayEntries", args.examDayEntryId);
	if (!examEntry || examEntry.ownerTokenIdentifier !== ownerTokenIdentifier) {
		throwUserFacingError("Prüfung nicht gefunden.");
	}
	if (examEntry.kind !== "Leistungskontrolle") {
		throwUserFacingError("Ein Lernplan braucht zuerst eine Prüfung.");
	}

	const subject = args.subject.trim();
	const examTypeLabel = args.examTypeLabel.trim();
	const topicDescription = args.topicDescription.trim();
	const notes = args.notes?.trim() ?? "";

	if (!subject) throwUserFacingError("Fach fehlt.");
	if (!examTypeLabel) throwUserFacingError("Prüfungsart fehlt.");
	if (options.requireMeaningfulTopic) {
		assertMeaningfulTopicDescription(topicDescription);
	}
	if (args.durationMinutes <= 0) {
		throwUserFacingError("Die Bearbeitungszeit muss größer als 0 sein.");
	}

	const now = Date.now();
	const learningPlanId = await ctx.db.insert("learningPlans", {
		ownerTokenIdentifier,
		subject,
		examTypeLabel,
		examDateKey: args.examDateKey,
		examDateLabel: args.examDateLabel,
		durationMinutes: args.durationMinutes,
		topicDescription,
		notes,
		status: "draft",
		preparationDepth: getDefaultPreparationDepth(examTypeLabel),
		examDayEntryId: args.examDayEntryId,
		createdAt: now,
		updatedAt: now,
	});
	await ctx.db.patch("dayEntries", args.examDayEntryId, {
		relatedLearningPlanId: learningPlanId,
	});
	return learningPlanId;
};

const publicDocument = (
	document: Doc<"learningPlanDocuments">,
): PublicDocument => ({
	id: document._id,
	fileName: document.fileName,
	fileType: document.fileType,
	fileSizeBytes: document.fileSizeBytes,
});

const publicAnswer = (answer: Doc<"learningPlanAnswers">): PublicAnswer => ({
	id: answer._id,
	questionId: answer.questionId,
	answer: answer.answer,
});

const publicSession = (
	session: Doc<"learningPlanSessions">,
): PublicSession => ({
	id: session._id,
	phase: session.phase,
	title: alignSessionDurationReferences({
		value: session.title,
		durationMinutes: session.durationMinutes,
	}),
	dateKey: session.dateKey,
	dateLabel: session.dateLabel,
	startTime: session.startTime,
	durationMinutes: session.durationMinutes,
	compositionVariant: session.compositionVariant,
	goal: alignSessionDurationReferences({
		value: session.goal,
		durationMinutes: session.durationMinutes,
	}),
	tasks: session.tasks,
	expectedOutcome: session.expectedOutcome,
	contentGenerationStatus: session.contentGenerationStatus,
	contentGenerationError: session.contentGenerationError,
	contentGeneratedAt: session.contentGeneratedAt,
	completed: session.completed ?? false,
	executionStatus: getSessionExecutionStatus(session),
	startedAt: session.startedAt,
	outcomeAt: session.outcomeAt,
	missedReason: session.missedReason,
	adjustedFromSessionId: session.adjustedFromSessionId,
	sortOrder: session.sortOrder,
});

const getSessionExecutionStatus = (session: Doc<"learningPlanSessions">) =>
	session.executionStatus ?? (session.completed ? "completed" : "notStarted");

const isCompletedStatus = (
	status: ReturnType<typeof getSessionExecutionStatus>,
) => status === "completed";

const getCurrentPlanningHint = (
	planningHint: string | undefined,
	options: { hasLearningTimes: boolean },
) => {
	if (!planningHint) return undefined;
	if (!options.hasLearningTimes) return planningHint;

	const currentHint = planningHint
		.replace(MISSING_LEARNING_TIMES_HINT, "")
		.replace(/\s+/g, " ")
		.trim();

	return currentHint.length > 0 ? currentHint : undefined;
};

const buildPlanAccessKey = (learningPlanId: Id<"learningPlans">) =>
	`learningPlan:${learningPlanId}`;

const startOfDay = (date: Date) => {
	const next = new Date(date);
	next.setHours(0, 0, 0, 0);
	return next;
};

const formatDateLabel = (date: Date) =>
	new Intl.DateTimeFormat("de-DE", {
		timeZone: "Europe/Berlin",
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(date);

const getDateKey = (date: Date) => startOfDay(date).toISOString();

const getAvailableDays = (examDateKey: string) => {
	const examTime = new Date(examDateKey).getTime();
	if (!Number.isFinite(examTime)) return 7;

	return Math.max(0, Math.ceil((examTime - Date.now()) / 86_400_000));
};

const getLearningPlanCalendarDayKeys = (examDateKey: string) => {
	const availableDays = getAvailableDays(examDateKey);
	const date = new Date(examDateKey);
	if (Number.isNaN(date.getTime())) return [];

	const dayKeys = [];
	for (let offset = availableDays; offset >= 0; offset -= 1) {
		const nextDate = new Date(date);
		nextDate.setUTCDate(nextDate.getUTCDate() - offset);
		dayKeys.push(nextDate.toISOString().slice(0, 10));
	}

	return dayKeys;
};

const getSessionDayEntryTitle = (
	plan: Doc<"learningPlans">,
	session: Pick<Doc<"learningPlanSessions">, "title">,
) => `${plan.subject} ${session.title}`;

const getSessionDayEntryNotes = (
	session: Pick<
		Doc<"learningPlanSessions">,
		"goal" | "tasks" | "expectedOutcome"
	>,
) =>
	[
		session.goal,
		...session.tasks.map((task) => `- ${task}`),
		session.expectedOutcome,
	].join("\n");

const createSessionDayEntry = async (
	ctx: MutationCtx,
	plan: Doc<"learningPlans">,
	session: Doc<"learningPlanSessions">,
) => {
	const executionStatus = getSessionExecutionStatus(session);
	return await ctx.db.insert("dayEntries", {
		ownerTokenIdentifier: session.ownerTokenIdentifier,
		dayKey: session.dateKey,
		title: getSessionDayEntryTitle(plan, session),
		time: session.startTime,
		kind: "Lernen",
		notes: getSessionDayEntryNotes(session),
		plannedDateLabel: session.dateLabel,
		durationMinutes: session.durationMinutes,
		completed: isCompletedStatus(executionStatus),
		executionStatus,
		startedAt: session.startedAt,
		outcomeAt: session.outcomeAt,
		missedReason: session.missedReason,
		adjustedFromSessionId: session.adjustedFromSessionId,
		relatedLearningPlanId: session.learningPlanId,
		relatedLearningPlanSessionId: session._id,
	});
};

const syncSessionDayEntry = async (
	ctx: MutationCtx,
	plan: Doc<"learningPlans">,
	session: Doc<"learningPlanSessions">,
) => {
	await assertNoScheduleConflict(ctx, {
		ownerTokenIdentifier: session.ownerTokenIdentifier,
		dayKey: session.dateKey,
		time: session.startTime,
		durationMinutes: session.durationMinutes,
		excludeDayEntryId: session.dayEntryId,
		excludeLearningPlanSessionId: session._id,
	});

	if (!session.dayEntryId) {
		const dayEntryId = await createSessionDayEntry(ctx, plan, session);
		await ctx.db.patch("learningPlanSessions", session._id, {
			dayEntryId,
			updatedAt: Date.now(),
		});
		return dayEntryId;
	}

	const existingEntry = await ctx.db.get("dayEntries", session.dayEntryId);
	if (
		!existingEntry ||
		existingEntry.ownerTokenIdentifier !== session.ownerTokenIdentifier
	) {
		const dayEntryId = await createSessionDayEntry(ctx, plan, session);
		await ctx.db.patch("learningPlanSessions", session._id, {
			dayEntryId,
			updatedAt: Date.now(),
		});
		return dayEntryId;
	}

	const executionStatus = getSessionExecutionStatus(session);
	await ctx.db.patch("dayEntries", session.dayEntryId, {
		dayKey: session.dateKey,
		title: getSessionDayEntryTitle(plan, session),
		time: session.startTime,
		kind: "Lernen",
		notes: getSessionDayEntryNotes(session),
		plannedDateLabel: session.dateLabel,
		durationMinutes: session.durationMinutes,
		completed: isCompletedStatus(executionStatus),
		executionStatus,
		startedAt: session.startedAt,
		outcomeAt: session.outcomeAt,
		missedReason: session.missedReason,
		adjustedFromSessionId: session.adjustedFromSessionId,
		relatedLearningPlanId: session.learningPlanId,
		relatedLearningPlanSessionId: session._id,
	});
	return session.dayEntryId;
};

const clearSessionDayEntry = async (
	ctx: MutationCtx,
	session: Doc<"learningPlanSessions">,
) => {
	if (!session.dayEntryId) return;

	const dayEntry = await ctx.db.get("dayEntries", session.dayEntryId);
	if (dayEntry?.ownerTokenIdentifier === session.ownerTokenIdentifier) {
		await ctx.db.delete("dayEntries", session.dayEntryId);
	}
	await ctx.db.patch("learningPlanSessions", session._id, {
		dayEntryId: undefined,
		updatedAt: Date.now(),
	});
};

const learningSessionEventPayload = (
	plan: Doc<"learningPlans">,
	session: Doc<"learningPlanSessions">,
) => ({
	learningPlanId: session.learningPlanId,
	learningPlanSessionId: session._id,
	phase: session.phase,
	plannedDayKey: session.dateKey,
	startTime: session.startTime,
	durationMinutes: session.durationMinutes,
	compositionVariant: session.compositionVariant ?? "control",
	activeStudySeconds: session.activeStudySeconds,
	subject: plan.subject,
	examTypeLabel: plan.examTypeLabel,
	examDateKey: plan.examDateKey,
});

const getOwnedSessionAndPlan = async (
	ctx: MutationCtx,
	sessionId: Id<"learningPlanSessions">,
) => {
	const ownerTokenIdentifier =
		await requireOwnerTokenIdentifierForMutation(ctx);
	const session = await ctx.db.get("learningPlanSessions", sessionId);
	if (!session || session.ownerTokenIdentifier !== ownerTokenIdentifier) {
		throwUserFacingError("Lernblock nicht gefunden.");
	}

	const plan = await ctx.db.get("learningPlans", session.learningPlanId);
	if (!plan || plan.ownerTokenIdentifier !== ownerTokenIdentifier) {
		throwUserFacingError("Lernplan nicht gefunden.");
	}

	return { ownerTokenIdentifier, session, plan };
};

const patchSessionAndSyncedEntry = async (
	ctx: MutationCtx,
	plan: Doc<"learningPlans">,
	session: Doc<"learningPlanSessions">,
	patch: Partial<
		Pick<
			Doc<"learningPlanSessions">,
			| "completed"
			| "executionStatus"
			| "startedAt"
			| "outcomeAt"
			| "activeStudySeconds"
			| "missedReason"
			| "adjustedFromSessionId"
		>
	>,
) => {
	await ctx.db.patch("learningPlanSessions", session._id, {
		...patch,
		updatedAt: Date.now(),
	});
	const updatedSession = await ctx.db.get("learningPlanSessions", session._id);
	if (updatedSession && plan.status === "accepted") {
		await syncSessionDayEntry(ctx, plan, updatedSession);
	}

	return updatedSession;
};

export const start = mutation({
	args: {
		examDayEntryId: v.id("dayEntries"),
		subject: v.string(),
		examTypeLabel: v.string(),
		examDateKey: v.string(),
		examDateLabel: v.string(),
		examTime: v.optional(v.string()),
		durationMinutes: v.number(),
		topicDescription: v.string(),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		return await createLearningPlan(ctx, args, {
			requireMeaningfulTopic: true,
		});
	},
});

export const createDraft = mutation({
	args: {
		examDayEntryId: v.id("dayEntries"),
		subject: v.string(),
		examTypeLabel: v.string(),
		examDateKey: v.string(),
		examDateLabel: v.string(),
		examTime: v.optional(v.string()),
		durationMinutes: v.number(),
		topicDescription: v.string(),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		return await createLearningPlan(ctx, args, {
			requireMeaningfulTopic: false,
		});
	},
});

export const updateBasics = mutation({
	args: {
		id: v.id("learningPlans"),
		topicDescription: v.string(),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const plan = await ctx.db.get("learningPlans", args.id);
		if (!plan || plan.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}
		if (plan.status !== "draft" && plan.status !== "questionsReady") {
			throwUserFacingError("Dieser Lernplan wurde bereits erstellt.");
		}

		const topicDescription = args.topicDescription.trim();
		const notes = args.notes?.trim() ?? "";
		assertMeaningfulTopicDescription(topicDescription);

		await ctx.db.patch("learningPlans", args.id, {
			topicDescription,
			notes,
			updatedAt: Date.now(),
		});
	},
});

export const setTargetStudyMinutes = mutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		targetStudyMinutes: v.number(),
		preparationDepth: v.optional(preparationDepthValidator),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}
		if (plan.status === "accepted") {
			throwUserFacingError("Dieser Lernplan wurde bereits eingetragen.");
		}
		if (
			!Number.isInteger(args.targetStudyMinutes) ||
			args.targetStudyMinutes < 10 ||
			args.targetStudyMinutes > 600
		) {
			throwUserFacingError(
				"Wähle eine gesamte Lernzeit zwischen 10 und 600 Minuten.",
			);
		}

		await ctx.db.patch("learningPlans", args.learningPlanId, {
			targetStudyMinutes: args.targetStudyMinutes,
			...(args.preparationDepth
				? { preparationDepth: args.preparationDepth }
				: {}),
			updatedAt: Date.now(),
		});
		return args.targetStudyMinutes;
	},
});

export const getSnapshot = query({
	args: {
		id: v.id("learningPlans"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const plan = await ctx.db.get("learningPlans", args.id);
		if (!plan || plan.ownerTokenIdentifier !== ownerTokenIdentifier) {
			return null;
		}

		const documents = await ctx.db
			.query("learningPlanDocuments")
			.withIndex("by_learningPlanId", (q) => q.eq("learningPlanId", args.id))
			.order("asc")
			.take(20);
		const answers = await ctx.db
			.query("learningPlanAnswers")
			.withIndex("by_learningPlanId", (q) => q.eq("learningPlanId", args.id))
			.order("asc")
			.take(20);
		const sessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", args.id),
			)
			.order("asc")
			.take(50);
		const learningTimes = await ctx.db
			.query("userLearningTimes")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(1);
		const readySessionCount = sessions.filter(
			(session) => session.contentGenerationStatus === "ready",
		).length;
		const failedSessionCount = sessions.filter(
			(session) => session.contentGenerationStatus === "failed",
		).length;

		return {
			plan: {
				id: plan._id,
				subject: plan.subject,
				examTypeLabel: plan.examTypeLabel,
				examDateKey: plan.examDateKey,
				examDateLabel: plan.examDateLabel,
				...(plan.examTime ? { examTime: plan.examTime } : {}),
				durationMinutes: plan.durationMinutes,
				targetStudyMinutes: plan.targetStudyMinutes,
				preparationDepth:
					(plan.preparationDepth as PreparationDepth | undefined) ??
					getDefaultPreparationDepth(plan.examTypeLabel),
				topicDescription: plan.topicDescription,
				notes: plan.notes,
				status: plan.status,
				knowledgeQuestions: plan.knowledgeQuestions ?? [],
				sourceSummary: plan.sourceSummary,
				topicMap: plan.topicMap ?? [],
				topicReadiness: plan.topicReadiness ?? [],
				insight: plan.insight,
				planningHint: getCurrentPlanningHint(plan.planningHint, {
					hasLearningTimes: learningTimes.length > 0,
				}),
				sessionCompositionVariant: plan.sessionCompositionVariant,
				contentGeneration: plan.contentGenerationStage
					? {
							stage: plan.contentGenerationStage,
							startedAt: plan.contentGenerationStartedAt,
							totalSessionCount: sessions.length,
							readySessionCount,
							failedSessionCount,
						}
					: undefined,
			},
			documents: documents.map(publicDocument),
			answers: answers.map(publicAnswer),
			sessions: sessions.map(publicSession),
		};
	},
});

export const listOverview = query({
	args: {},
	handler: async (ctx) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const plans = await ctx.db
			.query("learningPlans")
			.withIndex("by_ownerTokenIdentifier_and_status", (q) =>
				q
					.eq("ownerTokenIdentifier", ownerTokenIdentifier)
					.eq("status", "accepted"),
			)
			.order("desc")
			.take(50);

		const overviews = [];
		for (const plan of plans) {
			const sessions = await ctx.db
				.query("learningPlanSessions")
				.withIndex("by_learningPlanId_and_sortOrder", (q) =>
					q.eq("learningPlanId", plan._id),
				)
				.take(50);
			const completedCount = sessions.filter(
				(session) => session.completed === true,
			).length;
			const currentSession =
				sessions.find((session) => session.completed !== true) ??
				sessions.at(-1) ??
				null;
			const progressPercent =
				sessions.length > 0
					? Math.round((completedCount / sessions.length) * 100)
					: 0;

			overviews.push({
				id: plan._id,
				subject: plan.subject,
				examTypeLabel: plan.examTypeLabel,
				status: plan.status,
				progressPercent,
				completedCount,
				sessionCount: sessions.length,
				examDateKey: plan.examDateKey,
				examDateLabel: plan.examDateLabel,
				currentSession: currentSession
					? {
							id: currentSession._id,
							title: alignSessionDurationReferences({
								value: currentSession.title,
								durationMinutes: currentSession.durationMinutes,
							}),
							goal: alignSessionDurationReferences({
								value: currentSession.goal,
								durationMinutes: currentSession.durationMinutes,
							}),
							dateKey: currentSession.dateKey,
							dateLabel: currentSession.dateLabel,
							startTime: currentSession.startTime,
							durationMinutes: currentSession.durationMinutes,
							completed: currentSession.completed === true,
						}
					: null,
				updatedAt: plan.updatedAt,
			});
		}

		return overviews;
	},
});

export const saveKnowledgeAnswer = mutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		questionId: v.string(),
		answer: v.string(),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}
		if (plan.status === "accepted") {
			throwUserFacingError("Dieser Lernplan wurde bereits eingetragen.");
		}

		const questionExists = (plan.knowledgeQuestions ?? []).some(
			(question) => question.id === args.questionId,
		);
		if (!questionExists) {
			throwUserFacingError("Frage nicht gefunden.");
		}

		const answer = args.answer.trim();
		if (!answer) {
			throwUserFacingError("Antwort fehlt.");
		}

		const existingAnswer = await ctx.db
			.query("learningPlanAnswers")
			.withIndex("by_learningPlanId_and_questionId", (q) =>
				q
					.eq("learningPlanId", args.learningPlanId)
					.eq("questionId", args.questionId),
			)
			.unique();
		const now = Date.now();
		let answerId: Id<"learningPlanAnswers">;
		if (existingAnswer) {
			await ctx.db.patch("learningPlanAnswers", existingAnswer._id, {
				answer,
				updatedAt: now,
			});
			answerId = existingAnswer._id;
		} else {
			answerId = await ctx.db.insert("learningPlanAnswers", {
				ownerTokenIdentifier,
				learningPlanId: args.learningPlanId,
				questionId: args.questionId,
				answer,
				createdAt: now,
				updatedAt: now,
			});
		}
		const storedAnswers = await ctx.db
			.query("learningPlanAnswers")
			.withIndex("by_learningPlanId", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(20);
		await ctx.db.patch("learningPlans", args.learningPlanId, {
			topicReadiness: deriveTopicReadiness({
				topicIds: (plan.topicMap ?? []).map((topic) => topic.id),
				questions: plan.knowledgeQuestions ?? [],
				answers: storedAnswers.map((storedAnswer) => ({
					questionId: storedAnswer.questionId,
					answer: storedAnswer.answer,
				})),
			}),
			updatedAt: now,
		});
		return answerId;
	},
});

export const generateUploadUrl = mutation({
	args: {
		learningPlanId: v.id("learningPlans"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}

		const storageProvider = getConfiguredStorageProvider();
		return await ctx.runMutation(
			components.convexFilesControl.upload.generateUploadUrl,
			{
				provider: storageProvider,
				...(storageProvider === "r2" ? { r2Config: getR2ConfigOrThrow() } : {}),
			},
		);
	},
});

export const getUploadRegistrationContext = internalQuery({
	args: {
		learningPlanId: v.id("learningPlans"),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (identity === null) {
			throwUserFacingError("Nicht authentifiziert.");
		}

		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== identity.tokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}

		return {
			ownerTokenIdentifier: identity.tokenIdentifier,
			accessKey: buildPlanAccessKey(args.learningPlanId),
		};
	},
});

export const storeUploadedDocument = internalMutation({
	args: {
		ownerTokenIdentifier: v.string(),
		learningPlanId: v.id("learningPlans"),
		storageId: v.string(),
		storageProvider: v.union(v.literal("convex"), v.literal("r2")),
		fileName: v.string(),
		fileType: v.string(),
		fileSizeBytes: v.number(),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		return await ctx.db.insert("learningPlanDocuments", {
			...args,
			createdAt: now,
		});
	},
});

export const registerUploadedDocument = action({
	args: {
		learningPlanId: v.id("learningPlans"),
		uploadToken: v.string(),
		storageId: v.string(),
		fileName: v.string(),
		fileType: v.string(),
		fileSizeBytes: v.number(),
	},
	handler: async (ctx, args): Promise<Id<"learningPlanDocuments">> => {
		const context: {
			ownerTokenIdentifier: string;
			accessKey: string;
		} = await ctx.runQuery(
			internal.learningPlans.getUploadRegistrationContext,
			{
				learningPlanId: args.learningPlanId,
			},
		);

		const finalizedUpload = await ctx.runMutation(
			components.convexFilesControl.upload.finalizeUpload,
			{
				uploadToken: args.uploadToken,
				storageId: args.storageId,
				accessKeys: [context.accessKey],
			},
		);

		if (finalizedUpload.storageId !== args.storageId) {
			throwUserFacingError("Upload konnte nicht verifiziert werden.");
		}

		return await ctx.runMutation(internal.learningPlans.storeUploadedDocument, {
			ownerTokenIdentifier: context.ownerTokenIdentifier,
			learningPlanId: args.learningPlanId,
			storageId: args.storageId,
			storageProvider: finalizedUpload.storageProvider,
			fileName: args.fileName,
			fileType: args.fileType || "application/octet-stream",
			fileSizeBytes: finalizedUpload.metadata?.size ?? args.fileSizeBytes,
		});
	},
});

export const removeDocument = mutation({
	args: {
		id: v.id("learningPlanDocuments"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const document = await ctx.db.get("learningPlanDocuments", args.id);
		if (!document || document.ownerTokenIdentifier !== ownerTokenIdentifier) {
			return null;
		}

		await deleteManagedFile(ctx, {
			storageId: document.storageId,
			storageProvider: document.storageProvider,
		});
		await ctx.db.delete("learningPlanDocuments", args.id);
		return document.learningPlanId;
	},
});

export const removePlan = mutation({
	args: {
		id: v.id("learningPlans"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const plan = await ctx.db.get("learningPlans", args.id);
		if (!plan || plan.ownerTokenIdentifier !== ownerTokenIdentifier) {
			return null;
		}

		const documents = await ctx.db
			.query("learningPlanDocuments")
			.withIndex("by_learningPlanId", (q) => q.eq("learningPlanId", args.id))
			.take(100);
		for (const document of documents) {
			await deleteManagedFile(ctx, {
				storageId: document.storageId,
				storageProvider: document.storageProvider,
			});
			await ctx.db.delete("learningPlanDocuments", document._id);
		}

		const answers = await ctx.db
			.query("learningPlanAnswers")
			.withIndex("by_learningPlanId", (q) => q.eq("learningPlanId", args.id))
			.take(100);
		for (const answer of answers) {
			await ctx.db.delete("learningPlanAnswers", answer._id);
		}
		const aiUsage = await ctx.db
			.query("learningPlanAiUsage")
			.withIndex("by_learningPlanId", (q) => q.eq("learningPlanId", args.id))
			.take(1_000);
		for (const usage of aiUsage) {
			await ctx.db.delete("learningPlanAiUsage", usage._id);
		}

		const sessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", args.id),
			)
			.take(100);
		for (const session of sessions) {
			await deleteSessionLearningDataForSession(ctx, session._id);
			if (session.dayEntryId) {
				const dayEntry = await ctx.db.get("dayEntries", session.dayEntryId);
				if (dayEntry?.ownerTokenIdentifier === ownerTokenIdentifier) {
					await ctx.db.delete("dayEntries", session.dayEntryId);
				}
			}
			await ctx.db.delete("learningPlanSessions", session._id);
		}

		if (plan.examDayEntryId) {
			const examEntry = await ctx.db.get("dayEntries", plan.examDayEntryId);
			if (examEntry?.ownerTokenIdentifier === ownerTokenIdentifier) {
				await ctx.db.patch("dayEntries", plan.examDayEntryId, {
					relatedLearningPlanId: undefined,
				});
			}
		}

		const localSchedules = await ctx.db
			.query("localNotificationSchedules")
			.withIndex("by_ownerTokenIdentifier_and_expiresAt", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(500);
		for (const schedule of localSchedules) {
			if (schedule.relatedLearningPlanId === args.id) {
				await ctx.db.delete("localNotificationSchedules", schedule._id);
			}
		}

		const notificationHistory = await ctx.db
			.query("notificationHistory")
			.withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(500);
		const now = Date.now();
		for (const notification of notificationHistory) {
			if (
				notification.relatedLearningPlanId === args.id &&
				notification.deletedAt === undefined
			) {
				await ctx.db.patch("notificationHistory", notification._id, {
					deletedAt: now,
				});
			}
		}

		await ctx.db.delete("learningPlans", args.id);
		return args.id;
	},
});

export const getAiContext = internalQuery({
	args: {
		learningPlanId: v.id("learningPlans"),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (identity === null) {
			throwUserFacingError("Nicht authentifiziert.");
		}

		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== identity.tokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}

		const documents = await ctx.db
			.query("learningPlanDocuments")
			.withIndex("by_learningPlanId", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(20);
		const learningTimes = await ctx.db
			.query("userLearningTimes")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", identity.tokenIdentifier),
			)
			.take(MAX_LEARNING_TIMES);
		const occupiedEntries: Array<{
			dayKey: string;
			time?: string;
			durationMinutes?: number;
		}> = [];
		const seenEntryIds = new Set<string>();
		for (const dayKey of getLearningPlanCalendarDayKeys(plan.examDateKey)) {
			for (const queryDayKey of getDayKeyQueryVariants(dayKey)) {
				const entries = await ctx.db
					.query("dayEntries")
					.withIndex("by_ownerTokenIdentifier_and_dayKey", (q) =>
						q
							.eq("ownerTokenIdentifier", identity.tokenIdentifier)
							.eq("dayKey", queryDayKey),
					)
					.take(50);

				for (const entry of entries) {
					if (seenEntryIds.has(entry._id)) continue;
					seenEntryIds.add(entry._id);
					occupiedEntries.push({
						dayKey,
						time: isExamEntry(entry) ? undefined : entry.time,
						durationMinutes: entry.durationMinutes,
					});
				}
			}
		}

		return {
			plan,
			documents,
			learningTimes,
			occupiedEntries,
			accessKey: buildPlanAccessKey(args.learningPlanId),
		};
	},
});

export const getStoredKnowledgeAnswers = internalQuery({
	args: {
		learningPlanId: v.id("learningPlans"),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (identity === null) {
			throwUserFacingError("Nicht authentifiziert.");
		}

		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== identity.tokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}

		const answers = await ctx.db
			.query("learningPlanAnswers")
			.withIndex("by_learningPlanId", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(20);

		return answers.map((answer) => ({
			questionId: answer.questionId,
			answer: answer.answer,
		}));
	},
});

export const storeKnowledgeQuestions = internalMutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		questions: v.array(planQuestionValidator),
		sourceSummary: v.string(),
		topics: v.optional(v.array(learningTopicValidator)),
	},
	handler: async (ctx, args) => {
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan) throwUserFacingError("Lernplan nicht gefunden.");

		await ctx.db.patch("learningPlans", args.learningPlanId, {
			knowledgeQuestions: args.questions.map((question) => ({
				...question,
				prompt: normalizeGeneratedGermanText(question.prompt),
				targetInsight: normalizeGeneratedGermanText(question.targetInsight),
			})),
			sourceSummary: normalizeGeneratedGermanText(args.sourceSummary),
			topicMap: normalizeLearningTopics(args.topics ?? []),
			status: "questionsReady",
			updatedAt: Date.now(),
		});
	},
});

export const beginContentGeneration = internalMutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		generationId: v.string(),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}
		const now = Date.now();
		if (
			plan.contentGenerationId &&
			plan.contentGenerationStartedAt &&
			now - plan.contentGenerationStartedAt < STALE_CONTENT_GENERATION_MS &&
			plan.contentGenerationStage === "content"
		) {
			throwUserFacingError("Dieser Lernplan wird bereits erstellt.");
		}

		await ctx.db.patch("learningPlans", args.learningPlanId, {
			status: "questionsReady",
			contentGenerationStage: "content",
			contentGenerationId: args.generationId,
			contentGenerationStartedAt: now,
			updatedAt: now,
		});
		return now;
	},
});

export const clearEmptyContentGeneration = internalMutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		generationId: v.string(),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (
			!plan ||
			plan.ownerTokenIdentifier !== ownerTokenIdentifier ||
			plan.contentGenerationId !== args.generationId
		) {
			return false;
		}
		const sessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(1);
		if (sessions.length > 0) return false;

		await ctx.db.patch("learningPlans", args.learningPlanId, {
			contentGenerationStage: "failed",
			contentGenerationId: undefined,
			contentGenerationStartedAt: Date.now(),
			updatedAt: Date.now(),
		});
		return true;
	},
});

export const replaceGeneratedSessions = internalMutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		knowledgeAnswersJson: v.string(),
		sourceSummary: v.string(),
		insight: planInsightValidator,
		planningHint: v.optional(v.string()),
		sessionCompositionVariant: v.optional(sessionCompositionVariantValidator),
		deferReadyUntilContent: v.optional(v.boolean()),
		generationId: v.optional(v.string()),
		sessions: v.array(generatedSessionValidator),
	},
	handler: async (ctx, args) => {
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan) throwUserFacingError("Lernplan nicht gefunden.");
		if (args.generationId && plan.contentGenerationId !== args.generationId) {
			throwUserFacingError(
				"Diese Lernplan-Erstellung wurde durch einen neueren Versuch ersetzt.",
			);
		}

		const normalizedSourceSummary = normalizeGeneratedGermanText(
			args.sourceSummary,
		);
		const normalizedInsight = {
			summary: normalizeGeneratedGermanText(args.insight.summary),
			strengths: args.insight.strengths.map((strength) =>
				normalizeGeneratedGermanText(strength),
			),
			gaps: args.insight.gaps.map((gap) => normalizeGeneratedGermanText(gap)),
		};
		const normalizedSessions = args.sessions.map((session) => ({
			phase: session.phase,
			title: normalizeGeneratedGermanText(session.title),
			dateKey: session.dateKey,
			dateLabel: session.dateLabel,
			startTime: session.startTime,
			durationMinutes: session.durationMinutes,
			goal: normalizeGeneratedGermanText(session.goal),
			tasks: session.tasks.map((task) => normalizeGeneratedGermanText(task)),
			expectedOutcome: normalizeGeneratedGermanText(session.expectedOutcome),
			compositionVariant:
				getLearningSessionComposition({
					phase: session.phase,
					durationMinutes: session.durationMinutes,
					variant: args.sessionCompositionVariant ?? "control",
				}).length > 1
					? ("split" as const)
					: ("control" as const),
		}));

		const existingSessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(50);
		for (const session of existingSessions) {
			await deleteSessionLearningDataForSession(ctx, session._id);
			if (session.dayEntryId) {
				const dayEntry = await ctx.db.get("dayEntries", session.dayEntryId);
				if (dayEntry) {
					await ctx.db.delete("dayEntries", session.dayEntryId);
				}
			}
			await ctx.db.delete("learningPlanSessions", session._id);
		}

		const now = Date.now();
		const sessionIds: Id<"learningPlanSessions">[] = [];
		for (const [index, session] of normalizedSessions.entries()) {
			const sessionId = await ctx.db.insert("learningPlanSessions", {
				ownerTokenIdentifier: plan.ownerTokenIdentifier,
				learningPlanId: args.learningPlanId,
				...session,
				...(args.deferReadyUntilContent
					? { contentGenerationStatus: "queued" as const }
					: {}),
				sortOrder: index,
				createdAt: now,
				updatedAt: now,
			});
			sessionIds.push(sessionId);
		}

		await ctx.db.patch("learningPlans", args.learningPlanId, {
			knowledgeAnswersJson: args.knowledgeAnswersJson,
			planningHint: args.planningHint,
			sourceSummary: normalizedSourceSummary,
			insight: normalizedInsight,
			sessionCompositionVariant: args.sessionCompositionVariant ?? "control",
			status: args.deferReadyUntilContent ? "questionsReady" : "generated",
			contentGenerationStage: args.deferReadyUntilContent
				? "content"
				: undefined,
			updatedAt: now,
		});

		return args.deferReadyUntilContent ? { sessionIds } : null;
	},
});

export const setSessionContentGenerationStatus = internalMutation({
	args: {
		sessionId: v.id("learningPlanSessions"),
		status: contentGenerationStatusValidator,
		errorMessage: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const session = await ctx.db.get("learningPlanSessions", args.sessionId);
		if (!session || session.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Lernsession nicht gefunden.");
		}

		await ctx.db.patch("learningPlanSessions", args.sessionId, {
			contentGenerationStatus: args.status,
			contentGenerationError:
				args.status === "failed"
					? (args.errorMessage ?? "Die Fragen konnten nicht erstellt werden.")
					: undefined,
			contentGeneratedAt: args.status === "ready" ? Date.now() : undefined,
			updatedAt: Date.now(),
		});
	},
});

export const finalizeContentGeneration = internalMutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		generationId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}
		if (args.generationId && plan.contentGenerationId !== args.generationId) {
			throwUserFacingError(
				"Diese Lernplan-Erstellung wurde durch einen neueren Versuch ersetzt.",
			);
		}
		const sessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(50);
		const failedSessionCount = sessions.filter(
			(session) => session.contentGenerationStatus === "failed",
		).length;
		const readySessionCount = sessions.filter(
			(session) => session.contentGenerationStatus === "ready",
		).length;
		const isReady =
			sessions.length > 0 && readySessionCount === sessions.length;

		await ctx.db.patch("learningPlans", args.learningPlanId, {
			status:
				plan.status === "accepted"
					? "accepted"
					: isReady
						? "generated"
						: "questionsReady",
			contentGenerationStage: isReady
				? "ready"
				: failedSessionCount > 0
					? "failed"
					: "content",
			...(isReady
				? {
						contentGenerationId: undefined,
						contentGenerationStartedAt: undefined,
					}
				: {}),
			updatedAt: Date.now(),
		});
		return { readySessionCount, failedSessionCount, isReady };
	},
});

export const claimIncompleteContentGenerationSessions = internalMutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		generationId: v.string(),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}
		if (
			plan.contentGenerationStage === "content" &&
			plan.contentGenerationStartedAt &&
			Date.now() - plan.contentGenerationStartedAt < STALE_CONTENT_GENERATION_MS
		) {
			throwUserFacingError("Dieser Lernplan wird bereits erstellt.");
		}
		const sessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(50);
		const sessionIds = sessions
			.filter((session) => session.contentGenerationStatus !== "ready")
			.map((session) => session._id);
		const now = Date.now();
		await ctx.db.patch("learningPlans", args.learningPlanId, {
			status: "questionsReady",
			contentGenerationStage: "content",
			contentGenerationId: args.generationId,
			contentGenerationStartedAt: now,
			updatedAt: now,
		});
		return sessionIds;
	},
});

export const markContentGenerationClaimFailed = internalMutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		generationId: v.string(),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}
		if (plan.contentGenerationId !== args.generationId) return false;

		await ctx.db.patch("learningPlans", args.learningPlanId, {
			status: plan.status === "accepted" ? "accepted" : "questionsReady",
			contentGenerationStage: "failed",
			contentGenerationId: undefined,
			contentGenerationStartedAt: undefined,
			updatedAt: Date.now(),
		});
		return true;
	},
});

export const updateSession = mutation({
	args: {
		id: v.id("learningPlanSessions"),
		phase: phaseValidator,
		dateKey: v.string(),
		dateLabel: v.string(),
		startTime: v.string(),
		durationMinutes: v.number(),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const session = await ctx.db.get("learningPlanSessions", args.id);
		if (!session || session.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Lerntag nicht gefunden.");
		}
		const plan = await ctx.db.get("learningPlans", session.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}
		if (args.durationMinutes <= 0) {
			throwUserFacingError("Die Dauer muss größer als 0 sein.");
		}
		const contentInvalidated =
			session.phase !== args.phase ||
			session.durationMinutes !== args.durationMinutes;
		await assertNoScheduleConflict(ctx, {
			ownerTokenIdentifier,
			dayKey: args.dateKey,
			time: args.startTime,
			durationMinutes: args.durationMinutes,
			excludeDayEntryId: session.dayEntryId,
			excludeLearningPlanSessionId: session._id,
		});

		if (contentInvalidated) {
			await deleteSessionLearningDataForSession(ctx, args.id);
		}
		await ctx.db.patch("learningPlanSessions", args.id, {
			phase: args.phase,
			dateKey: args.dateKey,
			dateLabel: args.dateLabel,
			startTime: args.startTime,
			durationMinutes: args.durationMinutes,
			...(contentInvalidated
				? {
						contentGenerationStatus: "queued" as const,
						contentGenerationError: undefined,
						contentGeneratedAt: undefined,
					}
				: {}),
			updatedAt: Date.now(),
		});
		if (contentInvalidated) {
			await ctx.db.patch("learningPlans", plan._id, {
				...(plan.status === "accepted" ? {} : { status: "questionsReady" }),
				contentGenerationStage: "content",
				updatedAt: Date.now(),
			});
		}
		const updatedSession = await ctx.db.get("learningPlanSessions", args.id);
		if (updatedSession && plan.status === "accepted") {
			await syncSessionDayEntry(ctx, plan, updatedSession);
		} else if (updatedSession) {
			await clearSessionDayEntry(ctx, updatedSession);
		}
		return { contentInvalidated };
	},
});

export const addSession = mutation({
	args: {
		learningPlanId: v.id("learningPlans"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}

		const sessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(50);
		const lastSession = sessions.at(-1);
		const parsedExamDate = startOfDay(new Date(plan.examDateKey));
		const examDate = Number.isNaN(parsedExamDate.getTime())
			? startOfDay(new Date(Date.now() + 86_400_000))
			: parsedExamDate;
		const baseDate = lastSession
			? startOfDay(new Date(lastSession.dateKey))
			: startOfDay(new Date());
		const nextDate = new Date(baseDate);
		nextDate.setDate(nextDate.getDate() + 1);
		if (nextDate.getTime() >= examDate.getTime()) {
			nextDate.setDate(examDate.getDate() - 1);
		}
		if (Number.isNaN(nextDate.getTime())) {
			nextDate.setTime(startOfDay(new Date()).getTime());
		}

		const now = Date.now();
		const dateKey = getDateKey(nextDate);
		const startTime = lastSession?.startTime ?? "17:00";
		const durationMinutes = Math.min(lastSession?.durationMinutes ?? 15, 20);
		await assertNoScheduleConflict(ctx, {
			ownerTokenIdentifier,
			dayKey: dateKey,
			time: startTime,
			durationMinutes,
		});

		const highestSortOrderSession = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.order("desc")
			.take(1);

		const sessionId = await ctx.db.insert("learningPlanSessions", {
			ownerTokenIdentifier,
			learningPlanId: args.learningPlanId,
			phase: "practice",
			title: "Zusatzübung",
			dateKey,
			dateLabel: formatDateLabel(nextDate),
			startTime,
			durationMinutes,
			goal: "Zusätzlichen Lernblock ergänzen und individuell bearbeiten.",
			tasks: ["Aufgaben festlegen", "Ergebnis kontrollieren"],
			expectedOutcome: "Ein zusätzlicher Lernblock ist im Plan ergänzt.",
			contentGenerationStatus: "queued",
			sortOrder: (highestSortOrderSession[0]?.sortOrder ?? -1) + 1,
			createdAt: now,
			updatedAt: now,
		});
		const createdSession = await ctx.db.get("learningPlanSessions", sessionId);
		if (createdSession && plan.status === "accepted") {
			await syncSessionDayEntry(ctx, plan, createdSession);
		}
		await ctx.db.patch("learningPlans", args.learningPlanId, {
			contentGenerationStage: "content",
			contentGenerationStartedAt: now,
			updatedAt: now,
		});
		return sessionId;
	},
});

export const syncSessionsToCalendar = mutation({
	args: {
		learningPlanId: v.id("learningPlans"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}
		if (plan.status !== "accepted") {
			throwUserFacingError("Bestätige den Lernplan zuerst.");
		}

		const sessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.order("asc")
			.take(50);

		for (const session of sessions) {
			await syncSessionDayEntry(ctx, plan, session);
		}

		return sessions.length;
	},
});

export const startSession = mutation({
	args: {
		sessionId: v.id("learningPlanSessions"),
	},
	handler: async (ctx, args) => {
		const { session, plan } = await getOwnedSessionAndPlan(ctx, args.sessionId);
		const status = getSessionExecutionStatus(session);
		if (status !== "notStarted") {
			throwUserFacingError("Dieser Lernblock wurde bereits gestartet.");
		}

		const now = Date.now();
		const updatedSession = await patchSessionAndSyncedEntry(
			ctx,
			plan,
			session,
			{
				executionStatus: "started",
				startedAt: now,
				completed: false,
			},
		);

		return {
			...learningSessionEventPayload(plan, updatedSession ?? session),
			startedAt: now,
		};
	},
});

export const recordSessionOutcome = mutation({
	args: {
		sessionId: v.id("learningPlanSessions"),
		outcome: v.union(v.literal("completed"), v.literal("partiallyCompleted")),
		activeStudySeconds: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const { session, plan } = await getOwnedSessionAndPlan(ctx, args.sessionId);
		if (
			args.activeStudySeconds !== undefined &&
			(!Number.isInteger(args.activeStudySeconds) ||
				args.activeStudySeconds < 0)
		) {
			throwUserFacingError("Die aktive Lernzeit ist ungültig.");
		}
		const status = getSessionExecutionStatus(session);
		if (status !== "started") {
			throwUserFacingError("Starte den Lernblock zuerst.");
		}

		const now = Date.now();
		const updatedSession = await patchSessionAndSyncedEntry(
			ctx,
			plan,
			session,
			{
				executionStatus: args.outcome,
				outcomeAt: now,
				activeStudySeconds: args.activeStudySeconds,
				completed: args.outcome === "completed",
			},
		);

		return {
			...learningSessionEventPayload(plan, updatedSession ?? session),
			outcome: args.outcome,
			outcomeAt: now,
		};
	},
});

export const missSession = mutation({
	args: {
		sessionId: v.id("learningPlanSessions"),
		reason: missedReasonValidator,
	},
	handler: async (ctx, args) => {
		const { session, plan } = await getOwnedSessionAndPlan(ctx, args.sessionId);
		const status = getSessionExecutionStatus(session);
		if (status !== "notStarted" && status !== "started") {
			throwUserFacingError("Dieser Lernblock hat bereits ein Ergebnis.");
		}

		const now = Date.now();
		const updatedSession = await patchSessionAndSyncedEntry(
			ctx,
			plan,
			session,
			{
				executionStatus: "missed",
				missedReason: args.reason,
				outcomeAt: now,
				completed: false,
			},
		);

		return {
			...learningSessionEventPayload(plan, updatedSession ?? session),
			missedReason: args.reason,
			outcomeAt: now,
		};
	},
});

export const adjustMissedSession = mutation({
	args: {
		sessionId: v.id("learningPlanSessions"),
		dateKey: v.string(),
		dateLabel: v.string(),
		startTime: v.string(),
		durationMinutes: v.number(),
	},
	handler: async (ctx, args) => {
		const { ownerTokenIdentifier, session, plan } =
			await getOwnedSessionAndPlan(ctx, args.sessionId);
		const status = getSessionExecutionStatus(session);
		if (status !== "missed") {
			throwUserFacingError("Nur verpasste Lernblöcke können angepasst werden.");
		}
		if (args.durationMinutes <= 0) {
			throwUserFacingError("Die Dauer muss größer als 0 sein.");
		}

		await assertNoScheduleConflict(ctx, {
			ownerTokenIdentifier,
			dayKey: args.dateKey,
			time: args.startTime,
			durationMinutes: args.durationMinutes,
		});

		const sessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", session.learningPlanId),
			)
			.order("desc")
			.take(1);
		const sortOrder = (sessions[0]?.sortOrder ?? -1) + 1;
		const now = Date.now();
		const newSessionId = await ctx.db.insert("learningPlanSessions", {
			ownerTokenIdentifier,
			learningPlanId: session.learningPlanId,
			phase: session.phase,
			title: `Recovery: ${session.title}`,
			dateKey: args.dateKey,
			dateLabel: args.dateLabel,
			startTime: args.startTime,
			durationMinutes: args.durationMinutes,
			goal: "Den verpassten Lernblock kleiner neu starten.",
			tasks: session.tasks.slice(0, 2),
			expectedOutcome: session.expectedOutcome,
			adjustedFromSessionId: session._id,
			sortOrder,
			createdAt: now,
			updatedAt: now,
		});

		await patchSessionAndSyncedEntry(ctx, plan, session, {
			executionStatus: "adjusted",
			outcomeAt: now,
			completed: false,
		});

		const newSession = await ctx.db.get("learningPlanSessions", newSessionId);
		if (newSession && plan.status === "accepted") {
			await syncSessionDayEntry(ctx, plan, newSession);
		}

		return {
			...learningSessionEventPayload(plan, session),
			newLearningPlanSessionId: newSessionId,
			missedReason: session.missedReason,
			oldDateKey: session.dateKey,
			oldDurationMinutes: session.durationMinutes,
			newDateKey: args.dateKey,
			newDurationMinutes: args.durationMinutes,
			adjustedAt: now,
		};
	},
});

export const setSessionCompleted = mutation({
	args: {
		sessionId: v.id("learningPlanSessions"),
		completed: v.boolean(),
	},
	handler: async (ctx, args) => {
		const { session, plan } = await getOwnedSessionAndPlan(ctx, args.sessionId);
		const now = Date.now();
		await patchSessionAndSyncedEntry(ctx, plan, session, {
			completed: args.completed,
			executionStatus: args.completed ? "completed" : "notStarted",
			startedAt: args.completed ? (session.startedAt ?? now) : undefined,
			outcomeAt: args.completed ? now : undefined,
			missedReason: undefined,
		});

		return args.completed;
	},
});

export const removeSession = mutation({
	args: {
		id: v.id("learningPlanSessions"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const session = await ctx.db.get("learningPlanSessions", args.id);
		if (!session || session.ownerTokenIdentifier !== ownerTokenIdentifier) {
			return null;
		}

		if (session.dayEntryId) {
			await ctx.db.delete("dayEntries", session.dayEntryId);
		}
		await deleteSessionLearningDataForSession(ctx, args.id);
		await ctx.db.delete("learningPlanSessions", args.id);
		return session.learningPlanId;
	},
});

export const acceptPlan = mutation({
	args: {
		learningPlanId: v.id("learningPlans"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}

		const sessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.order("asc")
			.take(50);
		if (sessions.length === 0) {
			throwUserFacingError("Es gibt noch keine Lerntage zum Eintragen.");
		}
		if (
			plan.contentGenerationStage &&
			sessions.some((session) => session.contentGenerationStatus !== "ready")
		) {
			throwUserFacingError(
				"Warte, bis alle Fragen und Aufgaben vollständig vorbereitet sind.",
			);
		}

		const now = Date.now();
		let examDayEntryId = plan.examDayEntryId;
		if (!examDayEntryId) {
			examDayEntryId = await ctx.db.insert("dayEntries", {
				ownerTokenIdentifier,
				dayKey: plan.examDateKey,
				title: `${plan.subject} ${plan.examTypeLabel}`,
				kind: "Leistungskontrolle",
				plannedDateLabel: plan.examDateLabel,
				durationMinutes: plan.durationMinutes,
				examTypeLabel: plan.examTypeLabel,
				relatedLearningPlanId: args.learningPlanId,
			});
		}

		for (const session of sessions) {
			await syncSessionDayEntry(ctx, plan, session);
		}

		await ctx.db.patch("learningPlans", args.learningPlanId, {
			status: "accepted",
			examDayEntryId,
			acceptedAt: now,
			updatedAt: now,
		});

		return sessions[0]?.dateKey ?? plan.examDateKey;
	},
});
