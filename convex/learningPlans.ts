import { components } from "./_generated/api";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	action,
	internalMutation,
	internalQuery,
	mutation,
	query,
	type MutationCtx,
	type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import {
	deleteManagedFile,
	getConfiguredStorageProvider,
	getR2ConfigOrThrow,
} from "./fileStorage";

const phaseValidator = v.union(
	v.literal("theory"),
	v.literal("practice"),
	v.literal("rehearsal"),
);

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
	goal: string;
	tasks: string[];
	expectedOutcome: string;
	sortOrder: number;
};

const requireOwnerTokenIdentifier = async (ctx: QueryCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (identity === null) {
		throw new Error("Nicht authentifiziert.");
	}

	return identity.tokenIdentifier;
};

const requireOwnerTokenIdentifierForMutation = async (ctx: MutationCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (identity === null) {
		throw new Error("Nicht authentifiziert.");
	}

	return identity.tokenIdentifier;
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
	title: session.title,
	dateKey: session.dateKey,
	dateLabel: session.dateLabel,
	startTime: session.startTime,
	durationMinutes: session.durationMinutes,
	goal: session.goal,
	tasks: session.tasks,
	expectedOutcome: session.expectedOutcome,
	sortOrder: session.sortOrder,
});

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

export const start = mutation({
	args: {
		subject: v.string(),
		examTypeLabel: v.string(),
		examDateKey: v.string(),
		examDateLabel: v.string(),
		examTime: v.string(),
		durationMinutes: v.number(),
		topicDescription: v.string(),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier =
			await requireOwnerTokenIdentifierForMutation(ctx);
		const subject = args.subject.trim();
		const examTypeLabel = args.examTypeLabel.trim();
		const topicDescription = args.topicDescription.trim();
		const notes = args.notes?.trim() ?? "";

		if (!subject) throw new Error("Fach fehlt.");
		if (!examTypeLabel) throw new Error("Prüfungsart fehlt.");
		if (args.durationMinutes <= 0) {
			throw new Error("Die Bearbeitungszeit muss größer als 0 sein.");
		}

		const now = Date.now();
		return await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier,
			subject,
			examTypeLabel,
			examDateKey: args.examDateKey,
			examDateLabel: args.examDateLabel,
			examTime: args.examTime,
			durationMinutes: args.durationMinutes,
			topicDescription,
			notes,
			status: "draft",
			createdAt: now,
			updatedAt: now,
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
			throw new Error("Lernplan nicht gefunden.");
		}
		if (plan.status !== "draft" && plan.status !== "questionsReady") {
			throw new Error("Dieser Lernplan wurde bereits erstellt.");
		}

		const topicDescription = args.topicDescription.trim();
		const notes = args.notes?.trim() ?? "";

		await ctx.db.patch("learningPlans", args.id, {
			topicDescription,
			notes,
			updatedAt: Date.now(),
		});
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
			.take(20);

		return {
			plan: {
				id: plan._id,
				subject: plan.subject,
				examTypeLabel: plan.examTypeLabel,
				examDateKey: plan.examDateKey,
				examDateLabel: plan.examDateLabel,
				examTime: plan.examTime,
				durationMinutes: plan.durationMinutes,
				topicDescription: plan.topicDescription,
				notes: plan.notes,
				status: plan.status,
				knowledgeQuestions: plan.knowledgeQuestions ?? [],
				sourceSummary: plan.sourceSummary,
				insight: plan.insight,
			},
			documents: documents.map(publicDocument),
			answers: answers.map(publicAnswer),
			sessions: sessions.map(publicSession),
		};
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
			throw new Error("Lernplan nicht gefunden.");
		}
		if (plan.status === "accepted") {
			throw new Error("Dieser Lernplan wurde bereits eingetragen.");
		}

		const questionExists = (plan.knowledgeQuestions ?? []).some(
			(question) => question.id === args.questionId,
		);
		if (!questionExists) {
			throw new Error("Frage nicht gefunden.");
		}

		const answer = args.answer.trim();
		if (!answer) {
			throw new Error("Antwort fehlt.");
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
		if (existingAnswer) {
			await ctx.db.patch("learningPlanAnswers", existingAnswer._id, {
				answer,
				updatedAt: now,
			});
			return existingAnswer._id;
		}

		return await ctx.db.insert("learningPlanAnswers", {
			ownerTokenIdentifier,
			learningPlanId: args.learningPlanId,
			questionId: args.questionId,
			answer,
			createdAt: now,
			updatedAt: now,
		});
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
			throw new Error("Lernplan nicht gefunden.");
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
			throw new Error("Nicht authentifiziert.");
		}

		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== identity.tokenIdentifier) {
			throw new Error("Lernplan nicht gefunden.");
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
			throw new Error("Upload konnte nicht verifiziert werden.");
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

export const getAiContext = internalQuery({
	args: {
		learningPlanId: v.id("learningPlans"),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (identity === null) {
			throw new Error("Nicht authentifiziert.");
		}

		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== identity.tokenIdentifier) {
			throw new Error("Lernplan nicht gefunden.");
		}

		const documents = await ctx.db
			.query("learningPlanDocuments")
			.withIndex("by_learningPlanId", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(20);

		return {
			plan,
			documents,
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
			throw new Error("Nicht authentifiziert.");
		}

		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== identity.tokenIdentifier) {
			throw new Error("Lernplan nicht gefunden.");
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
	},
	handler: async (ctx, args) => {
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan) throw new Error("Lernplan nicht gefunden.");

		await ctx.db.patch("learningPlans", args.learningPlanId, {
			knowledgeQuestions: args.questions,
			sourceSummary: args.sourceSummary,
			status: "questionsReady",
			updatedAt: Date.now(),
		});
	},
});

export const replaceGeneratedSessions = internalMutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		knowledgeAnswersJson: v.string(),
		sourceSummary: v.string(),
		insight: planInsightValidator,
		sessions: v.array(generatedSessionValidator),
	},
	handler: async (ctx, args) => {
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan) throw new Error("Lernplan nicht gefunden.");

		const existingSessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(20);
		for (const session of existingSessions) {
			await ctx.db.delete("learningPlanSessions", session._id);
		}

		const now = Date.now();
		for (const [index, session] of args.sessions.entries()) {
			await ctx.db.insert("learningPlanSessions", {
				ownerTokenIdentifier: plan.ownerTokenIdentifier,
				learningPlanId: args.learningPlanId,
				...session,
				sortOrder: index,
				createdAt: now,
				updatedAt: now,
			});
		}

		await ctx.db.patch("learningPlans", args.learningPlanId, {
			knowledgeAnswersJson: args.knowledgeAnswersJson,
			sourceSummary: args.sourceSummary,
			insight: args.insight,
			status: "generated",
			updatedAt: now,
		});
	},
});

export const updateSession = mutation({
	args: {
		id: v.id("learningPlanSessions"),
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
			throw new Error("Lerntag nicht gefunden.");
		}
		if (args.durationMinutes <= 0) {
			throw new Error("Die Dauer muss größer als 0 sein.");
		}

		await ctx.db.patch("learningPlanSessions", args.id, {
			dateKey: args.dateKey,
			dateLabel: args.dateLabel,
			startTime: args.startTime,
			durationMinutes: args.durationMinutes,
			updatedAt: Date.now(),
		});
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
			throw new Error("Lernplan nicht gefunden.");
		}

		const sessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(20);
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
		return await ctx.db.insert("learningPlanSessions", {
			ownerTokenIdentifier,
			learningPlanId: args.learningPlanId,
			phase: "practice",
			title: "Zusatzübung",
			dateKey: getDateKey(nextDate),
			dateLabel: formatDateLabel(nextDate),
			startTime: lastSession?.startTime ?? "17:00",
			durationMinutes: lastSession?.durationMinutes ?? 45,
			goal: "Zusätzlichen Lernblock ergänzen und individuell bearbeiten.",
			tasks: ["Aufgaben festlegen", "Ergebnis kontrollieren"],
			expectedOutcome: "Ein zusätzlicher Lernblock ist im Plan ergänzt.",
			sortOrder:
				sessions.reduce(
					(maxSortOrder, session) => Math.max(maxSortOrder, session.sortOrder),
					-1,
				) + 1,
			createdAt: now,
			updatedAt: now,
		});
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
			throw new Error("Lernplan nicht gefunden.");
		}

		const sessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.order("asc")
			.take(20);
		if (sessions.length === 0) {
			throw new Error("Es gibt noch keine Lerntage zum Eintragen.");
		}

		const now = Date.now();
		let examDayEntryId = plan.examDayEntryId;
		if (!examDayEntryId) {
			examDayEntryId = await ctx.db.insert("dayEntries", {
				ownerTokenIdentifier,
				dayKey: plan.examDateKey,
				title: `${plan.subject} ${plan.examTypeLabel}`,
				time: plan.examTime,
				kind: "Leistungskontrolle",
				plannedDateLabel: plan.examDateLabel,
				durationMinutes: plan.durationMinutes,
				examTypeLabel: plan.examTypeLabel,
				relatedLearningPlanId: args.learningPlanId,
			});
		}

		for (const session of sessions) {
			if (session.dayEntryId) continue;

			const dayEntryId = await ctx.db.insert("dayEntries", {
				ownerTokenIdentifier,
				dayKey: session.dateKey,
				title: `${plan.subject} ${session.title}`,
				time: session.startTime,
				kind: "Lernen",
				notes: [
					session.goal,
					...session.tasks.map((task) => `- ${task}`),
					session.expectedOutcome,
				].join("\n"),
				plannedDateLabel: session.dateLabel,
				durationMinutes: session.durationMinutes,
				relatedLearningPlanId: args.learningPlanId,
				relatedLearningPlanSessionId: session._id,
			});

			await ctx.db.patch("learningPlanSessions", session._id, {
				dayEntryId,
				updatedAt: now,
			});
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
