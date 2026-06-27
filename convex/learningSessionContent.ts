import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { throwUserFacingError } from "./errors";
import { normalizeGeneratedGermanText } from "./generatedGermanText";

type SessionPhase = Doc<"learningPlanSessions">["phase"];
type SessionContentItemKind =
	| "learnCard"
	| "multipleChoice"
	| "written"
	| "voice";
type AnswerRating = "notCorrect" | "partiallyCorrect" | "correct";

type GeneratedItem = {
	kind: SessionContentItemKind;
	title: string;
	prompt: string;
	front?: string;
	back?: string;
	explanation: string;
	idealAnswer: string;
	choices?: Array<{ id: string; text: string }>;
	correctChoiceId?: string;
	evaluationKeywords: string[];
};

const requireOwnerTokenIdentifier = async (ctx: QueryCtx | MutationCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (identity === null) {
		throwUserFacingError("Nicht authentifiziert.");
	}

	return identity.tokenIdentifier;
};

const getOwnedSession = async (
	ctx: QueryCtx | MutationCtx,
	sessionId: Id<"learningPlanSessions">,
	ownerTokenIdentifier: string,
) => {
	const session = await ctx.db.get("learningPlanSessions", sessionId);
	if (!session || session.ownerTokenIdentifier !== ownerTokenIdentifier) {
		throwUserFacingError("Lernblock nicht gefunden.");
	}

	return session;
};

const getOwnedPlan = async (
	ctx: QueryCtx | MutationCtx,
	learningPlanId: Id<"learningPlans">,
	ownerTokenIdentifier: string,
) => {
	const plan = await ctx.db.get("learningPlans", learningPlanId);
	if (!plan || plan.ownerTokenIdentifier !== ownerTokenIdentifier) {
		throwUserFacingError("Lernplan nicht gefunden.");
	}

	return plan;
};

const publicItem = (item: Doc<"learningSessionContentItems">) => ({
	id: item._id,
	sessionId: item.sessionId,
	phase: item.phase,
	kind: item.kind,
	title: item.title,
	prompt: item.prompt,
	front: item.front,
	back: item.back,
	explanation: item.explanation,
	idealAnswer: item.idealAnswer,
	choices: item.choices ?? [],
	sortOrder: item.sortOrder,
});

const publicAttempt = (attempt: Doc<"learningSessionAnswerAttempts">) => ({
	id: attempt._id,
	itemId: attempt.itemId,
	sessionId: attempt.sessionId,
	selectedChoiceId: attempt.selectedChoiceId,
	answerText: attempt.answerText,
	transcript: attempt.transcript,
	rating: attempt.rating,
	feedback: attempt.feedback,
	perfectAnswer: attempt.perfectAnswer,
	timeSpentSeconds: attempt.timeSpentSeconds,
	createdAt: attempt.createdAt,
});

const publicAnalysis = (analysis: Doc<"learningSessionAnalyses">) => ({
	id: analysis._id,
	sessionId: analysis.sessionId,
	strengths: analysis.strengths,
	gaps: analysis.gaps,
	recommendation: analysis.recommendation,
	updatedAt: analysis.updatedAt,
});

const phaseLabel = (phase: SessionPhase) =>
	phase === "theory" ? "Theorie" : phase === "practice" ? "Üben" : "Praxis";

const normalizeText = (value: string) =>
	normalizeGeneratedGermanText(value).replace(/\s+/g, " ").trim();

const compact = (value: string, fallback: string) =>
	normalizeText(value || fallback) || fallback;

const wordPattern = /[\p{L}\p{N}]+/gu;
const stopWords = new Set([
	"aber",
	"auch",
	"auf",
	"aus",
	"bei",
	"das",
	"den",
	"der",
	"die",
	"du",
	"ein",
	"eine",
	"für",
	"ich",
	"ist",
	"mit",
	"oder",
	"und",
	"von",
	"was",
	"wenn",
	"wie",
	"zur",
]);

const extractKeywords = (parts: string[]) => {
	const keywords: string[] = [];
	for (const part of parts) {
		const words = normalizeText(part).toLowerCase().match(wordPattern) ?? [];
		for (const word of words) {
			if (word.length < 4 || stopWords.has(word)) continue;
			if (!keywords.includes(word)) keywords.push(word);
			if (keywords.length >= 8) return keywords;
		}
	}

	return keywords.length > 0 ? keywords : ["lernziel", "prüfung"];
};

const distinct = (values: string[]) => {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values
		.map((item) => normalizeText(item))
		.filter(Boolean)) {
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(value);
	}
	return result;
};

const buildTheoryItems = (
	plan: Doc<"learningPlans">,
	session: Doc<"learningPlanSessions">,
) => {
	const concepts = distinct([
		session.title,
		plan.topicDescription,
		session.goal,
		...session.tasks,
	]).slice(
		0,
		Math.max(1, Math.min(5, Math.ceil(session.durationMinutes / 15))),
	);

	return concepts.map<GeneratedItem>((concept, index) => {
		const keywords = extractKeywords([
			concept,
			session.goal,
			session.expectedOutcome,
			plan.topicDescription,
		]);
		const detail =
			session.tasks[index % Math.max(session.tasks.length, 1)] ??
			session.expectedOutcome;
		return {
			kind: "learnCard",
			title: `Lernkarte ${index + 1}`,
			prompt: concept,
			front: concept,
			back: compact(
				`${concept}: ${detail}. Merke dir besonders, wie das Lernziel "${session.goal}" damit zusammenhängt.`,
				session.goal,
			),
			explanation: compact(
				`Diese Karte gehört zu ${phaseLabel(session.phase)} und bereitet dich auf ${plan.examTypeLabel} vor.`,
				"Diese Karte bereitet dich auf die Prüfung vor.",
			),
			idealAnswer: compact(
				`${concept} sicher erklären und an einem Beispiel anwenden.`,
				concept,
			),
			evaluationKeywords: keywords,
		};
	});
};

const buildTaskItems = (
	plan: Doc<"learningPlans">,
	session: Doc<"learningPlanSessions">,
) => {
	const keywords = extractKeywords([
		plan.topicDescription,
		session.goal,
		...session.tasks,
		session.expectedOutcome,
	]);
	const focusTasks =
		session.tasks.length > 0
			? session.tasks
			: [session.goal, session.expectedOutcome];
	const targetCount = Math.max(
		3,
		Math.min(6, Math.ceil(session.durationMinutes / 12)),
	);
	const kinds: SessionContentItemKind[] = [
		"multipleChoice",
		"written",
		"voice",
	];
	const isPraxis = session.phase === "rehearsal";

	return Array.from({ length: targetCount }, (_, index): GeneratedItem => {
		const kind = kinds[index % kinds.length] ?? "written";
		const task = focusTasks[index % focusTasks.length] ?? session.goal;
		const title =
			kind === "multipleChoice"
				? "Auswahlfrage"
				: kind === "voice"
					? "Sprachaufgabe"
					: "Schreibaufgabe";
		const idealAnswer = compact(
			`${task} Erkläre deine Schritte und prüfe dein Ergebnis mit Bezug auf ${plan.topicDescription}.`,
			session.expectedOutcome,
		);

		if (kind === "multipleChoice") {
			return {
				kind,
				title,
				prompt: isPraxis
					? `Welche Strategie passt unter Zeitdruck am besten zu: ${task}?`
					: `Welche Strategie passt am besten zu: ${task}?`,
				explanation:
					"Prüfungsnah ist die Antwort, wenn du systematisch vorgehst und dein Ergebnis kontrollierst.",
				idealAnswer,
				choices: [
					{
						id: "correct",
						text: "Schrittweise lösen, jeden Schritt begründen und das Ergebnis prüfen.",
					},
					{
						id: "distractor-fast",
						text: "Direkt raten und erst am Ende überlegen, ob es passt.",
					},
					{
						id: "distractor-skip",
						text: "Die schwierige Stelle überspringen und keine Probe machen.",
					},
				],
				correctChoiceId: "correct",
				evaluationKeywords: keywords,
			};
		}

		return {
			kind,
			title,
			prompt:
				kind === "voice"
					? `Sprich deine Lösung laut ein: ${task}`
					: `Schreibe deine Lösung auf: ${task}`,
			explanation:
				"Eine starke Antwort nennt den Lösungsweg, vermeidet typische Lücken und kontrolliert das Ergebnis.",
			idealAnswer,
			evaluationKeywords: keywords,
		};
	});
};

const buildGeneratedItems = (
	plan: Doc<"learningPlans">,
	session: Doc<"learningPlanSessions">,
) =>
	session.phase === "theory"
		? buildTheoryItems(plan, session)
		: buildTaskItems(plan, session);

const listItems = async (
	ctx: QueryCtx | MutationCtx,
	sessionId: Id<"learningPlanSessions">,
) =>
	await ctx.db
		.query("learningSessionContentItems")
		.withIndex("by_sessionId_and_sortOrder", (q) =>
			q.eq("sessionId", sessionId),
		)
		.order("asc")
		.take(50);

const ensureItemsForSession = async (
	ctx: MutationCtx,
	session: Doc<"learningPlanSessions">,
	plan: Doc<"learningPlans">,
) => {
	const existingItems = await listItems(ctx, session._id);
	if (existingItems.length > 0) return existingItems;

	const now = Date.now();
	for (const [index, item] of buildGeneratedItems(plan, session).entries()) {
		await ctx.db.insert("learningSessionContentItems", {
			ownerTokenIdentifier: session.ownerTokenIdentifier,
			learningPlanId: session.learningPlanId,
			sessionId: session._id,
			phase: session.phase,
			kind: item.kind,
			title: normalizeText(item.title),
			prompt: normalizeText(item.prompt),
			front: item.front ? normalizeText(item.front) : undefined,
			back: item.back ? normalizeText(item.back) : undefined,
			explanation: normalizeText(item.explanation),
			idealAnswer: normalizeText(item.idealAnswer),
			choices: item.choices?.map((choice) => ({
				id: choice.id,
				text: normalizeText(choice.text),
			})),
			correctChoiceId: item.correctChoiceId,
			evaluationKeywords: item.evaluationKeywords.map((keyword) =>
				normalizeText(keyword.toLowerCase()),
			),
			sortOrder: index,
			createdAt: now,
			updatedAt: now,
		});
	}

	return await listItems(ctx, session._id);
};

const getLatestAttempts = async (
	ctx: QueryCtx | MutationCtx,
	items: Doc<"learningSessionContentItems">[],
) => {
	const attempts = [];
	for (const item of items) {
		const latest = await ctx.db
			.query("learningSessionAnswerAttempts")
			.withIndex("by_itemId_and_createdAt", (q) => q.eq("itemId", item._id))
			.order("desc")
			.take(1);
		if (latest[0]) attempts.push(latest[0]);
	}
	return attempts;
};

const normalizedAnswerWords = (value: string) =>
	new Set(
		(normalizeText(value).toLowerCase().match(wordPattern) ?? []).filter(
			Boolean,
		),
	);

const evaluateTextAnswer = (
	item: Doc<"learningSessionContentItems">,
	answer: string,
): AnswerRating => {
	const answerWords = normalizedAnswerWords(answer);
	const keywords = item.evaluationKeywords.filter(Boolean);
	const matchedCount = keywords.filter((keyword) =>
		answerWords.has(keyword),
	).length;
	const ratio = keywords.length === 0 ? 0 : matchedCount / keywords.length;

	if (ratio >= 0.45 || answerWords.size >= 18) return "correct";
	if (ratio > 0 || answerWords.size >= 7) return "partiallyCorrect";
	return "notCorrect";
};

const feedbackForRating = (
	item: Doc<"learningSessionContentItems">,
	rating: AnswerRating,
) => {
	if (rating === "correct") {
		return `Richtige Antwort. ${item.explanation}`;
	}
	if (rating === "partiallyCorrect") {
		return `Teilweise richtig. Du triffst einen Teil des Lösungswegs, solltest aber noch genauer werden. ${item.explanation}`;
	}
	return `Noch nicht korrekt. Schau dir die perfekte Antwort an und achte auf den vollständigen Lösungsweg. ${item.explanation}`;
};

const buildAnalysis = (
	session: Doc<"learningPlanSessions">,
	attempts: Doc<"learningSessionAnswerAttempts">[],
) => {
	const correctCount = attempts.filter(
		(attempt) => attempt.rating === "correct",
	).length;
	const partialCount = attempts.filter(
		(attempt) => attempt.rating === "partiallyCorrect",
	).length;
	const attemptedCount = attempts.length;
	const hasStrongResult =
		attemptedCount > 0 && correctCount + partialCount >= attemptedCount;

	return {
		strengths:
			attemptedCount === 0
				? ["Du hast den Lernblock geöffnet und kannst jetzt gezielt starten."]
				: hasStrongResult
					? ["Du arbeitest strukturiert und zeigst sichere Ansätze."]
					: ["Du hast erste Ansätze gezeigt und weißt, wo du ansetzen kannst."],
		gaps:
			attemptedCount === 0
				? ["Bearbeite die Aufgaben, damit deine Wissensanalyse genauer wird."]
				: correctCount === attemptedCount
					? ["Halte die Sicherheit bis zur Prüfung durch kurze Wiederholung."]
					: [
							"Wiederhole die Aufgaben, bei denen Lösungsweg oder Kontrolle noch fehlen.",
						],
		recommendation:
			session.phase === "rehearsal"
				? "Wiederhole heute die unsicheren Prüfungsschritte und plane morgen eine kurze Kontrolle."
				: "Übe als Nächstes gezielt die markierten Lücken und wiederhole danach eine passende Lernkarte.",
	};
};

export const ensureSessionContent = mutation({
	args: {
		sessionId: v.id("learningPlanSessions"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const session = await getOwnedSession(
			ctx,
			args.sessionId,
			ownerTokenIdentifier,
		);
		const plan = await getOwnedPlan(
			ctx,
			session.learningPlanId,
			ownerTokenIdentifier,
		);
		const items = await ensureItemsForSession(ctx, session, plan);

		return { itemCount: items.length };
	},
});

export const getSessionContent = query({
	args: {
		sessionId: v.id("learningPlanSessions"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const session = await getOwnedSession(
			ctx,
			args.sessionId,
			ownerTokenIdentifier,
		);
		const plan = await getOwnedPlan(
			ctx,
			session.learningPlanId,
			ownerTokenIdentifier,
		);
		const items = await listItems(ctx, args.sessionId);
		const attempts = await getLatestAttempts(ctx, items);
		const analysis = await ctx.db
			.query("learningSessionAnalyses")
			.withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
			.unique();

		return {
			plan: {
				id: plan._id,
				subject: plan.subject,
				examTypeLabel: plan.examTypeLabel,
				topicDescription: plan.topicDescription,
			},
			session: {
				id: session._id,
				learningPlanId: session.learningPlanId,
				phase: session.phase,
				title: session.title,
				dateLabel: session.dateLabel,
				startTime: session.startTime,
				durationMinutes: session.durationMinutes,
				goal: session.goal,
				expectedOutcome: session.expectedOutcome,
				completed: session.completed ?? false,
			},
			praxisDurationSeconds:
				session.phase === "rehearsal"
					? Math.max(10, Math.min(session.durationMinutes, 30)) * 60
					: null,
			items: items.map(publicItem),
			attempts: attempts.map(publicAttempt),
			analysis: analysis ? publicAnalysis(analysis) : null,
		};
	},
});

export const submitAnswer = mutation({
	args: {
		itemId: v.id("learningSessionContentItems"),
		selectedChoiceId: v.optional(v.string()),
		answerText: v.optional(v.string()),
		transcript: v.optional(v.string()),
		timeSpentSeconds: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const item = await ctx.db.get("learningSessionContentItems", args.itemId);
		if (!item || item.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Aufgabe nicht gefunden.");
		}

		const visibleAnswer = compact(
			args.transcript ?? args.answerText ?? args.selectedChoiceId ?? "",
			"",
		);
		if (!visibleAnswer) {
			throwUserFacingError("Antwort fehlt.");
		}

		const rating: AnswerRating =
			item.kind === "multipleChoice"
				? args.selectedChoiceId === item.correctChoiceId
					? "correct"
					: "notCorrect"
				: evaluateTextAnswer(item, visibleAnswer);
		const now = Date.now();
		const attemptId = await ctx.db.insert("learningSessionAnswerAttempts", {
			ownerTokenIdentifier,
			learningPlanId: item.learningPlanId,
			sessionId: item.sessionId,
			itemId: item._id,
			selectedChoiceId: args.selectedChoiceId,
			answerText: args.answerText ? normalizeText(args.answerText) : undefined,
			transcript: args.transcript ? normalizeText(args.transcript) : undefined,
			rating,
			feedback: feedbackForRating(item, rating),
			perfectAnswer: item.idealAnswer,
			timeSpentSeconds: args.timeSpentSeconds,
			createdAt: now,
		});

		const attempt = await ctx.db.get(
			"learningSessionAnswerAttempts",
			attemptId,
		);
		if (!attempt)
			throwUserFacingError("Antwort konnte nicht gespeichert werden.");
		return publicAttempt(attempt);
	},
});

export const finishSessionContent = mutation({
	args: {
		sessionId: v.id("learningPlanSessions"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const session = await getOwnedSession(
			ctx,
			args.sessionId,
			ownerTokenIdentifier,
		);
		const plan = await getOwnedPlan(
			ctx,
			session.learningPlanId,
			ownerTokenIdentifier,
		);
		const items = await ensureItemsForSession(ctx, session, plan);
		const attempts = await getLatestAttempts(ctx, items);
		const result = buildAnalysis(session, attempts);
		const now = Date.now();
		const existing = await ctx.db
			.query("learningSessionAnalyses")
			.withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
			.unique();

		if (existing) {
			await ctx.db.patch("learningSessionAnalyses", existing._id, {
				...result,
				updatedAt: now,
			});
			const analysis = await ctx.db.get(
				"learningSessionAnalyses",
				existing._id,
			);
			if (!analysis) throwUserFacingError("Wissensanalyse nicht gefunden.");
			return publicAnalysis(analysis);
		}

		const analysisId = await ctx.db.insert("learningSessionAnalyses", {
			ownerTokenIdentifier,
			learningPlanId: session.learningPlanId,
			sessionId: session._id,
			...result,
			createdAt: now,
			updatedAt: now,
		});
		const analysis = await ctx.db.get("learningSessionAnalyses", analysisId);
		if (!analysis) throwUserFacingError("Wissensanalyse nicht gefunden.");
		return publicAnalysis(analysis);
	},
});
