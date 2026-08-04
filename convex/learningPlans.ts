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
import { advanceRollingLearningPlan } from "./adaptiveLearningPlan";
import {
	type AdaptiveLearningTarget,
	adaptiveSessionCopy,
	selectNextAdaptiveLearningTarget,
} from "./adaptiveLearningPlanPolicy";
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
	learningEvidenceDimensionValidator,
	learningTopicValidator,
	normalizeLearningTopics,
} from "./learningTopicMap";
import { assertNoScheduleConflict, isExamEntry } from "./scheduleConflicts";
import {
	getActiveTimetableLessons,
	getTimetableDayOfWeek,
	getTimetableLessonDuration,
} from "./timetableOccurrences";
import {
	assertMeaningfulTeacherGuidance,
	assertMeaningfulTopicDescription,
} from "./topicDescriptionValidation";

const MAX_LEARNING_TIMES = 50;
const MIN_DIAGNOSTIC_QUESTION_COUNT = 5;
const MAX_DIAGNOSTIC_QUESTION_COUNT = 10;
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
	responseKind: v.optional(
		v.union(
			v.literal("multipleChoice"),
			v.literal("shortText"),
			v.literal("longText"),
		),
	),
	options: v.optional(v.array(v.string())),
	correctAnswer: v.optional(v.string()),
	idealAnswer: v.optional(v.string()),
	explanation: v.optional(v.string()),
	evidenceDimension: v.optional(learningEvidenceDimensionValidator),
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

type NormalizedGeneratedSession = {
	phase: "theory" | "practice" | "rehearsal";
	title: string;
	dateKey: string;
	dateLabel: string;
	startTime: string;
	durationMinutes: number;
	goal: string;
	tasks: string[];
	expectedOutcome: string;
	compositionVariant: "control" | "split";
	sessionPurpose?: "diagnostic" | "learning";
	planningStatus?: "committed" | "provisional";
	targetTopicIds?: string[];
	targetEvidenceDimension?: "understanding" | "problemSolving" | "independent";
	selectionReason?: string;
	adaptationRevision?: number;
};

const applyAdaptiveTargetToSession = (
	session: NormalizedGeneratedSession,
	target: AdaptiveLearningTarget,
	planningStatus: "committed" | "provisional",
	adaptationRevision: number,
) => ({
	...session,
	...adaptiveSessionCopy(target),
	phase: target.phase,
	compositionVariant:
		target.phase === "theory" ? ("split" as const) : ("control" as const),
	planningStatus,
	targetTopicIds: [target.topicId],
	targetEvidenceDimension: target.dimension,
	selectionReason: target.reason,
	adaptationRevision,
});

type StoredKnowledgeQuestion = NonNullable<
	Doc<"learningPlans">["knowledgeQuestions"]
>[number];

const validateFirstSessionDiagnosticQuestions = (
	questions: StoredKnowledgeQuestion[],
	topics: Doc<"learningPlans">["topicMap"],
) => {
	if (
		questions.length < MIN_DIAGNOSTIC_QUESTION_COUNT ||
		questions.length > MAX_DIAGNOSTIC_QUESTION_COUNT
	) {
		throwUserFacingError(
			`Der Wissenscheck braucht ${MIN_DIAGNOSTIC_QUESTION_COUNT} bis ${MAX_DIAGNOSTIC_QUESTION_COUNT} Fragen.`,
		);
	}

	const topicIds = new Set((topics ?? []).map((topic) => topic.id));
	const questionIds = new Set<string>();
	for (const question of questions) {
		if (!question.id.trim() || questionIds.has(question.id)) {
			throwUserFacingError(
				"Die Fragen des Wissenschecks brauchen eindeutige Kennungen.",
			);
		}
		questionIds.add(question.id);
		if (
			question.kind !== "performance" ||
			!question.topicId ||
			!topicIds.has(question.topicId) ||
			!question.evidenceDimension ||
			!question.idealAnswer?.trim() ||
			!question.explanation?.trim() ||
			!question.responseKind
		) {
			throwUserFacingError(
				"Jede Frage des Wissenschecks muss Wissen prüfen und einem Prüfungsthema zugeordnet sein.",
			);
		}

		if (question.responseKind === "multipleChoice") {
			const options = question.options ?? [];
			const uniqueOptions = new Set(options.map((option) => option.trim()));
			if (
				options.length < 2 ||
				uniqueOptions.size !== options.length ||
				!question.correctAnswer ||
				!options.includes(question.correctAnswer)
			) {
				throwUserFacingError(
					"Multiple-Choice-Fragen im Wissenscheck brauchen eindeutige Optionen und eine richtige Antwort.",
				);
			}
		}
	}
};

const insertFirstSessionDiagnosticItems = async (
	ctx: MutationCtx,
	args: {
		plan: Doc<"learningPlans">;
		sessionId: Id<"learningPlanSessions">;
		questions: StoredKnowledgeQuestion[];
		now: number;
	},
) => {
	for (const [questionIndex, question] of args.questions.entries()) {
		const choices =
			question.responseKind === "multipleChoice"
				? (question.options ?? []).map((option, optionIndex) => ({
						id: `diagnostic-${questionIndex + 1}-choice-${optionIndex + 1}`,
						text: option,
					}))
				: undefined;
		const correctChoiceId = choices?.find(
			(choice) => choice.text === question.correctAnswer,
		)?.id;

		await ctx.db.insert("learningSessionContentItems", {
			ownerTokenIdentifier: args.plan.ownerTokenIdentifier,
			learningPlanId: args.plan._id,
			sessionId: args.sessionId,
			phase: "practice",
			kind:
				question.responseKind === "multipleChoice"
					? "multipleChoice"
					: "written",
			title: `Frage ${questionIndex + 1}`,
			prompt: question.prompt,
			explanation: question.explanation ?? question.targetInsight,
			idealAnswer: question.idealAnswer ?? question.correctAnswer ?? "",
			choices,
			correctChoiceId,
			evaluationKeywords: (question.evaluationKeywords ?? []).map((keyword) =>
				keyword.toLowerCase(),
			),
			learningBlockIndex: 0,
			topicId: question.topicId,
			evidenceDimension: question.evidenceDimension,
			questionAngle: "diagnostic",
			coverageKey: `diagnostic:${question.id}`,
			estimatedSeconds: 60,
			sortOrder: questionIndex,
			createdAt: args.now,
			updatedAt: args.now,
		});
	}
};

type PublicDocument = {
	id: Id<"learningPlanDocuments">;
	fileName: string;
	fileType: string;
	fileSizeBytes: number;
	sourceKind: "school" | "external";
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
	sessionPurpose?: "diagnostic" | "learning";
	knowledgeValidationStatus?: "pending" | "completed" | "skipped";
	knowledgeValidationConfidence?: "unsure" | "somewhatSure" | "sure";
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
	planningStatus?: "committed" | "provisional";
	targetTopicIds?: string[];
	targetEvidenceDimension?: "understanding" | "problemSolving" | "independent";
	selectionReason?: string;
	adaptationRevision?: number;
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
	teacherGuidance?: string;
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
		teacherGuidance: topicDescription || undefined,
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
	sourceKind: document.sourceKind ?? "school",
});

const publicAnswer = (answer: Doc<"learningPlanAnswers">): PublicAnswer => ({
	id: answer._id,
	questionId: answer.questionId,
	answer: answer.answer,
});

const publicQuestion = (
	question: NonNullable<Doc<"learningPlans">["knowledgeQuestions"]>[number],
) => ({
	id: question.id,
	prompt: question.prompt,
	targetInsight: question.targetInsight,
	...(question.topicId !== undefined ? { topicId: question.topicId } : {}),
	...(question.kind !== undefined ? { kind: question.kind } : {}),
	...(question.responseKind !== undefined
		? { responseKind: question.responseKind }
		: {}),
	...(question.options !== undefined ? { options: question.options } : {}),
	...(question.evaluationKeywords !== undefined
		? { evaluationKeywords: question.evaluationKeywords }
		: {}),
});

const invalidateDerivedExamEvidence = async (
	ctx: MutationCtx,
	learningPlanId: Id<"learningPlans">,
	updatedAt: number,
	sourcePatch: Partial<
		Pick<Doc<"learningPlans">, "teacherGuidance" | "topicDescription">
	> = {},
) => {
	const answers = await ctx.db
		.query("learningPlanAnswers")
		.withIndex("by_learningPlanId", (q) =>
			q.eq("learningPlanId", learningPlanId),
		)
		.take(20);
	for (const answer of answers) {
		await ctx.db.delete("learningPlanAnswers", answer._id);
	}
	await ctx.db.patch("learningPlans", learningPlanId, {
		...sourcePatch,
		knowledgeQuestions: undefined,
		diagnosticPlacement: undefined,
		sourceSummary: undefined,
		topicMap: undefined,
		scopeConfirmedAt: undefined,
		topicReadiness: undefined,
		contentGenerationStage: undefined,
		contentGenerationId: undefined,
		contentGenerationStartedAt: undefined,
		status: "draft",
		updatedAt,
	});
};

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
	sessionPurpose: session.sessionPurpose,
	knowledgeValidationStatus: session.knowledgeValidationStatus,
	knowledgeValidationConfidence: session.knowledgeValidationConfidence,
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
	planningStatus: session.planningStatus,
	targetTopicIds: session.targetTopicIds,
	targetEvidenceDimension: session.targetEvidenceDimension,
	selectionReason: session.selectionReason,
	adaptationRevision: session.adaptationRevision,
	sortOrder: session.sortOrder,
});

const getSessionExecutionStatus = (session: Doc<"learningPlanSessions">) =>
	session.executionStatus ?? (session.completed ? "completed" : "notStarted");

const assertDiagnosticIsComplete = async (
	ctx: MutationCtx,
	session: Doc<"learningPlanSessions">,
) => {
	if (session.sessionPurpose !== "diagnostic") return;
	const items = await ctx.db
		.query("learningSessionContentItems")
		.withIndex("by_sessionId_and_sortOrder", (q) =>
			q.eq("sessionId", session._id),
		)
		.take(20);
	const attempts = await ctx.db
		.query("learningSessionAnswerAttempts")
		.withIndex("by_sessionId_and_createdAt", (q) =>
			q.eq("sessionId", session._id),
		)
		.take(100);
	const attemptedItemIds = new Set(attempts.map((attempt) => attempt.itemId));
	if (
		items.length < MIN_DIAGNOSTIC_QUESTION_COUNT ||
		items.length > MAX_DIAGNOSTIC_QUESTION_COUNT ||
		items.some((item) => !attemptedItemIds.has(item._id))
	) {
		throwUserFacingError("Beantworte zuerst alle Fragen des Wissenschecks.");
	}
};

const isContentCommittedSession = (session: Doc<"learningPlanSessions">) =>
	session.planningStatus === "committed" ||
	(session.planningStatus === undefined &&
		session.contentGenerationStatus !== undefined);

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

const startOfUtcDay = (date: Date) => {
	const next = new Date(date);
	next.setUTCHours(0, 0, 0, 0);
	return next;
};

const formatDateLabel = (date: Date) =>
	new Intl.DateTimeFormat("de-DE", {
		timeZone: "Europe/Berlin",
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(date);

const getDateKey = (date: Date) => startOfUtcDay(date).toISOString();

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

export const updateExamEvidence = mutation({
	args: {
		id: v.id("learningPlans"),
		teacherGuidance: v.string(),
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

		const teacherGuidance = args.teacherGuidance.trim();
		if (teacherGuidance) {
			assertMeaningfulTeacherGuidance(teacherGuidance);
		}
		if ((plan.teacherGuidance ?? "") === teacherGuidance) {
			return plan.updatedAt;
		}
		const updatedAt = Date.now();
		await invalidateDerivedExamEvidence(ctx, args.id, updatedAt, {
			teacherGuidance: teacherGuidance || undefined,
			topicDescription: teacherGuidance,
		});
		return updatedAt;
	},
});

export const confirmScope = mutation({
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
		if (plan.status !== "questionsReady") {
			throwUserFacingError(
				"Der Prüfungsumfang kann in diesem Lernplan nicht mehr geändert werden.",
			);
		}
		if ((plan.topicMap ?? []).length === 0) {
			throwUserFacingError("Der Prüfungsstoff wurde noch nicht analysiert.");
		}
		if ((plan.knowledgeQuestions ?? []).length === 0) {
			throwUserFacingError("Die kurzen Einstiegsfragen fehlen noch.");
		}

		const confirmedAt = Date.now();
		await ctx.db.patch("learningPlans", args.learningPlanId, {
			scopeConfirmedAt: confirmedAt,
			updatedAt: confirmedAt,
		});
		return confirmedAt;
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
			(session) =>
				session.planningStatus !== "provisional" &&
				session.contentGenerationStatus === "ready",
		).length;
		const failedSessionCount = sessions.filter(
			(session) =>
				session.planningStatus !== "provisional" &&
				session.contentGenerationStatus === "failed",
		).length;
		const committedSessionCount = sessions.filter(
			isContentCommittedSession,
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
				teacherGuidance: plan.teacherGuidance,
				notes: plan.notes,
				status: plan.status,
				knowledgeQuestions: (plan.knowledgeQuestions ?? []).map(publicQuestion),
				diagnosticPlacement: plan.diagnosticPlacement,
				sourceSummary: plan.sourceSummary,
				topicMap: plan.topicMap ?? [],
				scopeConfirmedAt: plan.scopeConfirmedAt,
				topicReadiness: plan.topicReadiness ?? [],
				insight: plan.insight,
				planningHint: getCurrentPlanningHint(plan.planningHint, {
					hasLearningTimes: learningTimes.length > 0,
				}),
				rollingPlanEnabled: plan.rollingPlanEnabled,
				adaptationRevision: plan.adaptationRevision,
				sessionCompositionVariant: plan.sessionCompositionVariant,
				contentGeneration: plan.contentGenerationStage
					? {
							stage: plan.contentGenerationStage,
							startedAt: plan.contentGenerationStartedAt,
							totalSessionCount: committedSessionCount,
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
			const upcomingSessionCount = sessions.filter((session) =>
				["notStarted", "started"].includes(getSessionExecutionStatus(session)),
			).length;
			const hasOpenRollingWindow =
				plan.rollingPlanEnabled === true && upcomingSessionCount > 0;
			const currentSession =
				sessions.find(
					(session) =>
						["notStarted", "started"].includes(
							getSessionExecutionStatus(session),
						) && session.planningStatus !== "provisional",
				) ??
				sessions.at(-1) ??
				null;
			const completedStudyMinutes = sessions.reduce((total, session) => {
				const status = getSessionExecutionStatus(session);
				const activeMinutes = Math.min(
					session.durationMinutes,
					Math.max(0, (session.activeStudySeconds ?? 0) / 60),
				);
				if (status === "completed") {
					return (
						total +
						(activeMinutes > 0 ? activeMinutes : session.durationMinutes)
					);
				}
				return status === "partiallyCompleted" ? total + activeMinutes : total;
			}, 0);
			const rollingProgressPercent =
				plan.targetStudyMinutes && plan.targetStudyMinutes > 0
					? Math.round(
							Math.min(1, completedStudyMinutes / plan.targetStudyMinutes) *
								100,
						)
					: 0;
			const progressPercent = plan.rollingPlanEnabled
				? hasOpenRollingWindow
					? Math.min(99, rollingProgressPercent)
					: rollingProgressPercent
				: sessions.length > 0
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
				upcomingSessionCount,
				rollingPlanEnabled: plan.rollingPlanEnabled === true,
				hasOpenRollingWindow,
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
							sessionPurpose: currentSession.sessionPurpose,
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
		sourceKind: v.union(v.literal("school"), v.literal("external")),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const documentId = await ctx.db.insert("learningPlanDocuments", {
			...args,
			createdAt: now,
		});
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (plan && plan.status !== "accepted" && args.sourceKind === "school") {
			await invalidateDerivedExamEvidence(ctx, args.learningPlanId, now);
		}
		return documentId;
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
		sourceKind: v.union(v.literal("school"), v.literal("external")),
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
			sourceKind: args.sourceKind,
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
		const plan = await ctx.db.get("learningPlans", document.learningPlanId);
		if (
			plan &&
			plan.status !== "accepted" &&
			(document.sourceKind ?? "school") === "school"
		) {
			await invalidateDerivedExamEvidence(
				ctx,
				document.learningPlanId,
				Date.now(),
			);
		}
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
		const timetableLessons = await getActiveTimetableLessons(
			ctx,
			identity.tokenIdentifier,
		);
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
			const dayOfWeek = getTimetableDayOfWeek(dayKey);
			for (const lesson of timetableLessons.filter(
				(item) => item.dayOfWeek === dayOfWeek,
			)) {
				occupiedEntries.push({
					dayKey,
					time: lesson.startTime,
					durationMinutes: getTimetableLessonDuration(lesson) ?? undefined,
				});
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
		diagnosticPlacement: v.optional(v.literal("firstSession")),
	},
	handler: async (ctx, args) => {
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan) throwUserFacingError("Lernplan nicht gefunden.");
		const topics = normalizeLearningTopics(args.topics ?? []);
		const normalizedTopicIdByInputId = new Map<string, string>();
		for (const [index, inputTopic] of (args.topics ?? []).entries()) {
			const normalizedTopic = topics[index];
			if (!normalizedTopic) break;
			const inputId = inputTopic.id.trim();
			if (inputId && !normalizedTopicIdByInputId.has(inputId)) {
				normalizedTopicIdByInputId.set(inputId, normalizedTopic.id);
			}
		}
		const questions: StoredKnowledgeQuestion[] = args.questions.map(
			(question) => {
				const inputTopicId = question.topicId?.trim();
				const topicId = inputTopicId
					? (normalizedTopicIdByInputId.get(inputTopicId) ?? inputTopicId)
					: undefined;
				return {
					...question,
					id: question.id.trim(),
					topicId,
					prompt: normalizeGeneratedGermanText(question.prompt),
					targetInsight: normalizeGeneratedGermanText(question.targetInsight),
					options: question.options?.map((option) =>
						normalizeGeneratedGermanText(option),
					),
					correctAnswer: question.correctAnswer
						? normalizeGeneratedGermanText(question.correctAnswer)
						: undefined,
					idealAnswer: question.idealAnswer
						? normalizeGeneratedGermanText(question.idealAnswer)
						: undefined,
					explanation: question.explanation
						? normalizeGeneratedGermanText(question.explanation)
						: undefined,
					evaluationKeywords: question.evaluationKeywords?.map((keyword) =>
						normalizeGeneratedGermanText(keyword),
					),
				};
			},
		);
		if (args.diagnosticPlacement === "firstSession") {
			validateFirstSessionDiagnosticQuestions(questions, topics);
		}

		await ctx.db.patch("learningPlans", args.learningPlanId, {
			knowledgeQuestions: questions,
			diagnosticPlacement: args.diagnosticPlacement,
			sourceSummary: normalizeGeneratedGermanText(args.sourceSummary),
			topicMap: topics,
			scopeConfirmedAt: undefined,
			contentGenerationStage: undefined,
			contentGenerationId: undefined,
			contentGenerationStartedAt: undefined,
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
		if (plan.diagnosticPlacement !== "firstSession") {
			throwUserFacingError(
				"Erstelle zuerst den Wissenscheck neu. Er ist der erste Block jedes Lernplans.",
			);
		}
		if ((plan.topicMap ?? []).length > 0 && !plan.scopeConfirmedAt) {
			throwUserFacingError("Bestätige zuerst den erkannten Prüfungsstoff.");
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
		deferFutureContent: v.optional(v.boolean()),
		rollingWindow: v.optional(v.boolean()),
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
		const normalizedSessions: NormalizedGeneratedSession[] = args.sessions.map(
			(session) => ({
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
						variant:
							args.sessionCompositionVariant ??
							(session.phase === "theory" ? "split" : "control"),
					}).length > 1
						? ("split" as const)
						: ("control" as const),
			}),
		);
		const usesFirstSessionDiagnostic =
			plan.diagnosticPlacement === "firstSession";
		const rollingWindow =
			args.rollingWindow === true || usesFirstSessionDiagnostic;
		const diagnosticQuestions = plan.knowledgeQuestions ?? [];
		if (usesFirstSessionDiagnostic) {
			validateFirstSessionDiagnosticQuestions(
				diagnosticQuestions,
				plan.topicMap,
			);
		}
		const adaptationRevision = rollingWindow
			? (plan.adaptationRevision ?? 0) + 1
			: (plan.adaptationRevision ?? 0);
		const sourceTopics =
			plan.topicMap && plan.topicMap.length > 0
				? plan.topicMap
				: normalizeLearningTopics([
						{
							id: "exam-scope",
							title: plan.topicDescription,
							learningGoal: plan.topicDescription,
							keywords: [plan.subject],
							priority: "high" as const,
						},
					]);
		const firstTarget = rollingWindow
			? selectNextAdaptiveLearningTarget({
					topics: sourceTopics,
					initialReadiness: plan.topicReadiness ?? [],
					evidence: [],
				})
			: null;
		const secondTarget =
			rollingWindow && firstTarget
				? selectNextAdaptiveLearningTarget({
						topics: sourceTopics,
						initialReadiness: plan.topicReadiness ?? [],
						evidence: [
							{
								topicId: firstTarget.topicId,
								dimension: firstTarget.dimension,
								rating: "correct",
								sessionId: "projected-first-session",
								createdAt: Date.now(),
							},
						],
					})
				: null;
		const sessionsToStore: NormalizedGeneratedSession[] =
			usesFirstSessionDiagnostic
				? (() => {
						const diagnosticSlot = normalizedSessions[0];
						const provisionalSlot = normalizedSessions[1];
						if (!diagnosticSlot || !provisionalSlot) {
							throwUserFacingError(
								"Für den Wissenscheck und den nächsten Lernschritt werden zwei freie Lernzeiten benötigt.",
							);
						}
						return [
							{
								...diagnosticSlot,
								phase: "practice",
								title: "Wissenscheck",
								compositionVariant: "control",
								sessionPurpose: "diagnostic",
								goal: "Zeige mit kurzen Aufgaben, was du bereits sicher kannst.",
								tasks: [
									"Beantworte 5 bis 10 kurze Fragen ohne Lernhilfen.",
									"Nutze dein aktuelles Wissen; der nächste Lernschritt wird danach angepasst.",
								],
								expectedOutcome:
									"Dein aktueller Wissensstand ist erfasst und bestimmt den nächsten Lernschritt.",
								planningStatus: "committed",
								adaptationRevision,
							},
							firstTarget
								? {
										...applyAdaptiveTargetToSession(
											provisionalSlot,
											firstTarget,
											"provisional",
											adaptationRevision,
										),
										sessionPurpose: "learning" as const,
									}
								: {
										...provisionalSlot,
										sessionPurpose: "learning" as const,
										planningStatus: "provisional" as const,
										adaptationRevision,
									},
						];
					})()
				: rollingWindow
					? normalizedSessions.slice(0, 2).flatMap((session, index) => {
							const target = index === 0 ? firstTarget : secondTarget;
							if (!target && index > 0) return [];
							return [
								target
									? {
											...applyAdaptiveTargetToSession(
												session,
												target,
												index === 0 ? "committed" : "provisional",
												adaptationRevision,
											),
											sessionPurpose: "learning" as const,
										}
									: {
											...session,
											sessionPurpose: "learning" as const,
											planningStatus: "committed" as const,
											adaptationRevision,
										},
							];
						})
					: normalizedSessions.map((session) => ({
							...session,
							sessionPurpose: "learning" as const,
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
		const contentSessionIds: Id<"learningPlanSessions">[] = [];
		for (const [index, session] of sessionsToStore.entries()) {
			const isDiagnostic = session.sessionPurpose === "diagnostic";
			const shouldPrepareContent =
				!isDiagnostic &&
				args.deferReadyUntilContent &&
				(!args.deferFutureContent ||
					(rollingWindow
						? session.planningStatus !== "provisional"
						: index === 0));
			const sessionId = await ctx.db.insert("learningPlanSessions", {
				ownerTokenIdentifier: plan.ownerTokenIdentifier,
				learningPlanId: args.learningPlanId,
				...session,
				...(session.compositionVariant === "split"
					? { knowledgeValidationStatus: "pending" as const }
					: {}),
				...(isDiagnostic
					? {
							contentGenerationStatus: "ready" as const,
							contentGeneratedAt: now,
						}
					: shouldPrepareContent
						? { contentGenerationStatus: "queued" as const }
						: {}),
				sortOrder: index,
				createdAt: now,
				updatedAt: now,
			});
			sessionIds.push(sessionId);
			if (isDiagnostic) {
				await insertFirstSessionDiagnosticItems(ctx, {
					plan,
					sessionId,
					questions: diagnosticQuestions,
					now,
				});
			} else if (shouldPrepareContent) {
				contentSessionIds.push(sessionId);
			}
		}

		await ctx.db.patch("learningPlans", args.learningPlanId, {
			knowledgeAnswersJson: args.knowledgeAnswersJson,
			planningHint: args.planningHint,
			sourceSummary: normalizedSourceSummary,
			insight: normalizedInsight,
			rollingPlanEnabled: rollingWindow,
			adaptationRevision,
			sessionCompositionVariant: args.sessionCompositionVariant ?? "split",
			status: args.deferReadyUntilContent ? "questionsReady" : "generated",
			contentGenerationStage: args.deferReadyUntilContent
				? "content"
				: undefined,
			updatedAt: now,
		});

		return args.deferReadyUntilContent
			? { sessionIds, contentSessionIds }
			: null;
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

		const now = Date.now();
		await ctx.db.patch("learningPlanSessions", args.sessionId, {
			contentGenerationStatus: args.status,
			contentGenerationError:
				args.status === "failed"
					? (args.errorMessage ?? "Die Fragen konnten nicht erstellt werden.")
					: undefined,
			contentGenerationStartedAt:
				args.status === "generating" ? now : undefined,
			contentGeneratedAt: args.status === "ready" ? now : undefined,
			updatedAt: now,
		});
	},
});

export const claimSessionContentGeneration = internalMutation({
	args: {
		sessionId: v.id("learningPlanSessions"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const session = await ctx.db.get("learningPlanSessions", args.sessionId);
		if (!session || session.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Lernsession nicht gefunden.");
		}

		const now = Date.now();
		if (
			session.contentGenerationStatus === "generating" &&
			session.contentGenerationStartedAt !== undefined &&
			now - session.contentGenerationStartedAt < STALE_CONTENT_GENERATION_MS
		) {
			return false;
		}

		await ctx.db.patch("learningPlanSessions", args.sessionId, {
			contentGenerationStatus: "generating",
			contentGenerationError: undefined,
			contentGenerationStartedAt: now,
			contentGeneratedAt: undefined,
			updatedAt: now,
		});
		return true;
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
		const committedSessions = sessions.filter(isContentCommittedSession);
		const failedSessionCount = committedSessions.filter(
			(session) => session.contentGenerationStatus === "failed",
		).length;
		const readySessionCount = committedSessions.filter(
			(session) => session.contentGenerationStatus === "ready",
		).length;
		const isReady =
			committedSessions.length > 0 &&
			readySessionCount === committedSessions.length;

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
			.filter(
				(session) =>
					session.planningStatus !== "provisional" &&
					session.contentGenerationStatus !== undefined &&
					session.contentGenerationStatus !== "ready",
			)
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
		if (session.sessionPurpose === "diagnostic" && args.phase !== "practice") {
			throwUserFacingError("Der Wissenscheck bleibt eine Fragensession.");
		}
		const contentInvalidated =
			session.sessionPurpose !== "diagnostic" &&
			(session.phase !== args.phase ||
				session.durationMinutes !== args.durationMinutes);
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
		const parsedExamDate = startOfUtcDay(new Date(plan.examDateKey));
		const examDate = Number.isNaN(parsedExamDate.getTime())
			? startOfUtcDay(new Date(Date.now() + 86_400_000))
			: parsedExamDate;
		const baseDate = lastSession
			? startOfUtcDay(new Date(lastSession.dateKey))
			: startOfUtcDay(new Date());
		const nextDate = new Date(baseDate);
		nextDate.setUTCDate(nextDate.getUTCDate() + 1);
		if (nextDate.getTime() >= examDate.getTime()) {
			nextDate.setUTCDate(examDate.getUTCDate() - 1);
		}
		if (Number.isNaN(nextDate.getTime())) {
			nextDate.setTime(startOfUtcDay(new Date()).getTime());
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
			sessionPurpose: "learning",
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
			if (session.planningStatus !== "provisional") {
				await syncSessionDayEntry(ctx, plan, session);
			}
		}

		return sessions.length;
	},
});

const advanceOwnedRollingLearningPlan = (
	ctx: MutationCtx,
	plan: Doc<"learningPlans">,
) =>
	advanceRollingLearningPlan(ctx, plan, {
		clearSession: clearSessionDayEntry,
		syncSession: syncSessionDayEntry,
	});
export const startSession = mutation({
	args: {
		sessionId: v.id("learningPlanSessions"),
	},
	handler: async (ctx, args) => {
		const { session, plan } = await getOwnedSessionAndPlan(ctx, args.sessionId);
		if (session.planningStatus === "provisional") {
			throwUserFacingError(
				"Dieser Lernblock ist nur eine Vorschau und kann sich noch ändern.",
			);
		}
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
		if (session.sessionPurpose === "diagnostic") {
			if (args.outcome !== "completed") {
				throwUserFacingError(
					"Schließe den Wissenscheck vollständig ab, bevor der nächste Lernschritt festgelegt wird.",
				);
			}
			await assertDiagnosticIsComplete(ctx, session);
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
		const rollingUpdate = await advanceOwnedRollingLearningPlan(ctx, plan);

		return {
			...learningSessionEventPayload(plan, updatedSession ?? session),
			outcome: args.outcome,
			outcomeAt: now,
			rollingUpdate,
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
			.order("asc")
			.take(50);
		const provisional = plan.rollingPlanEnabled
			? sessions.find((candidate) => candidate.planningStatus === "provisional")
			: undefined;
		const sortOrder = plan.rollingPlanEnabled
			? session.sortOrder + 1
			: (sessions.at(-1)?.sortOrder ?? -1) + 1;
		if (provisional && provisional.sortOrder <= sortOrder) {
			await ctx.db.patch("learningPlanSessions", provisional._id, {
				sortOrder: sortOrder + 1,
				updatedAt: Date.now(),
			});
		}
		const now = Date.now();
		const isDiagnosticRecovery = session.sessionPurpose === "diagnostic";
		const diagnosticQuestions = plan.knowledgeQuestions ?? [];
		if (isDiagnosticRecovery) {
			validateFirstSessionDiagnosticQuestions(
				diagnosticQuestions,
				plan.topicMap,
			);
		}
		const newSessionId = await ctx.db.insert("learningPlanSessions", {
			ownerTokenIdentifier,
			learningPlanId: session.learningPlanId,
			phase: isDiagnosticRecovery ? "practice" : session.phase,
			title: isDiagnosticRecovery
				? "Wissenscheck nachholen"
				: `Recovery: ${session.title}`,
			sessionPurpose: session.sessionPurpose ?? "learning",
			dateKey: args.dateKey,
			dateLabel: args.dateLabel,
			startTime: args.startTime,
			durationMinutes: args.durationMinutes,
			goal: isDiagnosticRecovery
				? "Zeige mit kurzen Aufgaben, was du bereits sicher kannst."
				: "Den verpassten Lernblock kleiner neu starten.",
			tasks: isDiagnosticRecovery
				? ["Beantworte die kurzen Fragen ohne Lernhilfen."]
				: session.tasks.slice(0, 2),
			expectedOutcome: session.expectedOutcome,
			adjustedFromSessionId: session._id,
			...(isDiagnosticRecovery
				? {
						contentGenerationStatus: "ready" as const,
						contentGeneratedAt: now,
						planningStatus: "committed" as const,
						adaptationRevision: plan.adaptationRevision,
					}
				: plan.rollingPlanEnabled
					? {
							contentGenerationStatus: "queued" as const,
							planningStatus: "committed" as const,
							targetTopicIds: session.targetTopicIds,
							targetEvidenceDimension: session.targetEvidenceDimension,
							selectionReason:
								"Neu geplant: Du startest den verpassten Lernblock kleiner, bevor der nächste Schwerpunkt festgelegt wird.",
							adaptationRevision: plan.adaptationRevision,
						}
					: {}),
			sortOrder,
			createdAt: now,
			updatedAt: now,
		});
		if (isDiagnosticRecovery) {
			await insertFirstSessionDiagnosticItems(ctx, {
				plan,
				sessionId: newSessionId,
				questions: diagnosticQuestions,
				now,
			});
		}

		await patchSessionAndSyncedEntry(ctx, plan, session, {
			executionStatus: "adjusted",
			outcomeAt: now,
			completed: false,
		});

		const newSession = await ctx.db.get("learningPlanSessions", newSessionId);
		if (newSession && plan.status === "accepted") {
			await syncSessionDayEntry(ctx, plan, newSession);
		}
		if (plan.rollingPlanEnabled) {
			await ctx.db.patch("learningPlans", plan._id, {
				contentGenerationStage: isDiagnosticRecovery ? "ready" : "content",
				contentGenerationStartedAt: isDiagnosticRecovery ? undefined : now,
				updatedAt: now,
			});
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
		if (args.completed && getSessionExecutionStatus(session) === "completed") {
			return true;
		}
		if (args.completed) await assertDiagnosticIsComplete(ctx, session);
		const now = Date.now();
		await patchSessionAndSyncedEntry(ctx, plan, session, {
			completed: args.completed,
			executionStatus: args.completed ? "completed" : "notStarted",
			startedAt: args.completed ? (session.startedAt ?? now) : undefined,
			outcomeAt: args.completed ? now : undefined,
			missedReason: undefined,
		});
		if (args.completed) {
			await advanceOwnedRollingLearningPlan(ctx, plan);
		}

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
		if (session.sessionPurpose === "diagnostic") {
			throwUserFacingError(
				"Der Wissenscheck ist der erste Block dieses Lernplans und kann nicht entfernt werden.",
			);
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
			plan.diagnosticPlacement !== "firstSession" ||
			sessions[0]?.sessionPurpose !== "diagnostic"
		) {
			throwUserFacingError(
				"Erstelle zuerst den Wissenscheck neu. Er ist der erste Block jedes Lernplans.",
			);
		}
		if (
			plan.contentGenerationStage &&
			sessions.some(
				(session) =>
					session.planningStatus !== "provisional" &&
					session.contentGenerationStatus !== undefined &&
					session.contentGenerationStatus !== "ready",
			)
		) {
			throwUserFacingError(
				"Warte, bis dein nächster Lernschritt vollständig vorbereitet ist.",
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
			if (session.planningStatus !== "provisional") {
				await syncSessionDayEntry(ctx, plan, session);
			}
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
