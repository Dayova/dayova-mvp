import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { throwUserFacingError } from "./errors";
import { normalizeGeneratedGermanText } from "./generatedGermanText";
import { type TheoryContent, theoryContentValidator } from "./theoryContent";

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
	theoryContent?: TheoryContent;
	choices?: Array<{ id: string; text: string }>;
	correctChoiceId?: string;
	evaluationKeywords: string[];
};

const generatedChoiceValidator = v.object({
	id: v.string(),
	text: v.string(),
});

const generatedSessionContentItemValidator = v.object({
	kind: v.union(
		v.literal("learnCard"),
		v.literal("multipleChoice"),
		v.literal("written"),
		v.literal("voice"),
	),
	title: v.string(),
	prompt: v.string(),
	front: v.optional(v.string()),
	back: v.optional(v.string()),
	explanation: v.string(),
	idealAnswer: v.string(),
	theoryContent: v.optional(theoryContentValidator),
	choices: v.optional(v.array(generatedChoiceValidator)),
	correctChoiceId: v.optional(v.string()),
	evaluationKeywords: v.array(v.string()),
});

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

const getSessionExecutionStatus = (session: Doc<"learningPlanSessions">) =>
	session.executionStatus ?? (session.completed ? "completed" : "notStarted");

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
	theoryContent: item.theoryContent,
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

const targetTheoryCardCount = (durationMinutes: number) =>
	Math.max(3, Math.min(12, Math.ceil(durationMinutes / 6)));

const targetTaskCount = (durationMinutes: number) =>
	Math.max(4, Math.min(10, Math.ceil(durationMinutes / 8)));

const buildTheoryItems = (
	plan: Doc<"learningPlans">,
	session: Doc<"learningPlanSessions">,
) => {
	const baseConcepts = distinct([
		plan.topicDescription,
		session.goal,
		...session.tasks,
		session.expectedOutcome,
	]);
	const cardCount = targetTheoryCardCount(session.durationMinutes);

	return Array.from({ length: cardCount }, (_, index): GeneratedItem => {
		const concept =
			baseConcepts[index % Math.max(baseConcepts.length, 1)] ??
			plan.topicDescription;
		const keywords = extractKeywords([
			concept,
			session.goal,
			session.expectedOutcome,
			plan.topicDescription,
		]);
		const detail =
			session.tasks[index % Math.max(session.tasks.length, 1)] ??
			session.expectedOutcome;
		const front =
			index === 0
				? `Was musst du zu ${concept} sicher erklären können?`
				: index % 3 === 1
					? `Wie wendest du ${concept} in einer Aufgabe an?`
					: `Welcher typische Fehler passiert bei ${concept}?`;
		const example = compact(
			`Nutze "${detail}" als Prüfungsaufgabe und erkläre jeden Schritt.`,
			detail,
		);
		const commonMistake = compact(
			"Eine Umformung oder Begründung auslassen.",
			"Begründe jeden Schritt.",
		);
		const explanation = compact(`${concept}: ${detail}`, session.goal);
		const memoryCue = compact(
			`Erkläre ${concept} kurz, wende es an einem Beispiel an und nenne den häufigsten Fehler.`,
			concept,
		);
		return {
			kind: "learnCard",
			title: concept,
			prompt: front,
			front,
			back: compact(
				`${explanation} Beispiel: ${example} Typischer Fehler: ${commonMistake}`,
				session.goal,
			),
			explanation,
			idealAnswer: memoryCue,
			theoryContent: {
				conceptTitle: concept,
				question: front,
				explanation,
				keyPoints: [
					compact(detail, session.goal),
					compact(session.expectedOutcome, plan.topicDescription),
				],
				example,
				memoryCue,
				commonMistake,
			},
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
	const targetCount = targetTaskCount(session.durationMinutes);
	const kinds: SessionContentItemKind[] = [
		"multipleChoice",
		"written",
		"voice",
	];
	const isPraxis = session.phase === "rehearsal";
	const phasePrefix = isPraxis ? "Generalprobe" : "Übung";

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
			`${task} Löse die Aufgabe Schritt für Schritt, begründe jede Umformung und prüfe dein Ergebnis mit Bezug auf ${plan.topicDescription}.`,
			session.expectedOutcome,
		);

		if (kind === "multipleChoice") {
			return {
				kind,
				title,
				prompt: isPraxis
					? `${phasePrefix} ${index + 1}: Welche Aussage ist für "${task}" fachlich richtig?`
					: `${phasePrefix} ${index + 1}: Welche Lösungsidee passt zu "${task}"?`,
				explanation:
					"Die richtige Antwort verbindet den passenden Rechenschritt mit einer Kontrolle des Ergebnisses.",
				idealAnswer,
				choices: [
					{
						id: "correct",
						text: `Erst den passenden Schritt zu "${task}" ausführen, dann begründen und mit einer Probe prüfen.`,
					},
					{
						id: "distractor-fast",
						text: "Direkt ein Ergebnis raten und die Zwischenschritte auslassen.",
					},
					{
						id: "distractor-skip",
						text: "Die Kontrolle weglassen, solange das Ergebnis ungefähr passend aussieht.",
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
					? `${phasePrefix} ${index + 1}: Erkläre laut deinen Lösungsweg zu "${task}".`
					: `${phasePrefix} ${index + 1}: Löse "${task}" schriftlich und notiere die Probe.`,
			explanation:
				"Eine starke Antwort nennt den vollständigen Lösungsweg, vermeidet typische Fehler und kontrolliert das Ergebnis.",
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

const insertGeneratedItemsForSession = async (
	ctx: MutationCtx,
	session: Doc<"learningPlanSessions">,
	items: GeneratedItem[],
) => {
	const now = Date.now();
	for (const [index, item] of items.entries()) {
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
			theoryContent: item.theoryContent
				? {
						conceptTitle: normalizeText(item.theoryContent.conceptTitle),
						question: normalizeText(item.theoryContent.question),
						explanation: normalizeText(item.theoryContent.explanation),
						keyPoints: item.theoryContent.keyPoints
							.slice(0, 4)
							.map(normalizeText),
						example: normalizeText(item.theoryContent.example),
						memoryCue: normalizeText(item.theoryContent.memoryCue),
						commonMistake: normalizeText(item.theoryContent.commonMistake),
					}
				: undefined,
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
};

const ensureItemsForSession = async (
	ctx: MutationCtx,
	session: Doc<"learningPlanSessions">,
	plan: Doc<"learningPlans">,
) => {
	const existingItems = await listItems(ctx, session._id);
	if (existingItems.length > 0) return existingItems;

	await insertGeneratedItemsForSession(
		ctx,
		session,
		buildGeneratedItems(plan, session),
	);

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
	items: Doc<"learningSessionContentItems">[],
	attempts: Doc<"learningSessionAnswerAttempts">[],
) => {
	const itemById = new Map(items.map((item) => [item._id, item]));
	const correctCount = attempts.filter(
		(attempt) => attempt.rating === "correct",
	).length;
	const partialCount = attempts.filter(
		(attempt) => attempt.rating === "partiallyCorrect",
	).length;
	const attemptedCount = attempts.length;
	const hasStrongResult =
		attemptedCount > 0 && correctCount + partialCount >= attemptedCount;
	const missedPrompts = attempts
		.filter((attempt) => attempt.rating !== "correct")
		.map((attempt) => itemById.get(attempt.itemId)?.prompt)
		.filter((prompt): prompt is string => Boolean(prompt))
		.slice(0, 3);
	const firstCorrectPrompt = attempts
		.map((attempt) =>
			attempt.rating === "correct"
				? itemById.get(attempt.itemId)?.prompt
				: undefined,
		)
		.find((prompt): prompt is string => Boolean(prompt));

	return {
		strengths:
			attemptedCount === 0
				? ["Du hast den Lernblock geöffnet und kannst jetzt gezielt starten."]
				: correctCount === attemptedCount
					? ["Du hast alle bearbeiteten Aufgaben sicher gelöst."]
					: hasStrongResult
						? [
								firstCorrectPrompt
									? `Du zeigst sichere Ansätze bei: ${firstCorrectPrompt}`
									: "Du zeigst sichere Ansätze und kommst bei mehreren Aufgaben voran.",
							]
						: [
								"Du hast erste Ansätze gezeigt und weißt, wo du ansetzen kannst.",
							],
		gaps:
			attemptedCount === 0
				? ["Bearbeite die Aufgaben, damit deine Wissensanalyse genauer wird."]
				: correctCount === attemptedCount
					? ["Halte die Sicherheit bis zur Prüfung durch kurze Wiederholung."]
					: missedPrompts.length > 0
						? missedPrompts.map((prompt) => `Wiederhole: ${prompt}`)
						: [
								"Wiederhole die Aufgaben, bei denen Lösungsweg oder Kontrolle noch fehlen.",
							],
		recommendation:
			session.phase === "rehearsal"
				? missedPrompts[0]
					? `Wiederhole zuerst diese Prüfungsaufgabe: ${missedPrompts[0]}`
					: "Wiederhole heute die unsicheren Prüfungsschritte und plane morgen eine kurze Kontrolle."
				: missedPrompts[0]
					? `Übe als Nächstes gezielt: ${missedPrompts[0]}`
					: "Übe als Nächstes gezielt die markierten Lücken und wiederhole danach eine passende Lernkarte.",
	};
};

const isLegacyTheoryItem = (item: Doc<"learningSessionContentItems">) =>
	item.kind === "learnCard" &&
	(item.back?.includes("Merke dir besonders, wie das Lernziel") ||
		item.back?.includes("damit zusammenhängt"));

const isLegacyTaskItem = (item: Doc<"learningSessionContentItems">) =>
	item.kind !== "learnCard" &&
	(item.prompt.includes("Welche Strategie passt") ||
		item.prompt.includes("Schreibe deine Lösung auf:") ||
		item.prompt.includes("Sprich deine Lösung laut ein:") ||
		item.explanation.includes("Eine starke Antwort nennt den Lösungsweg") ||
		item.explanation.includes("Prüfungsnah ist die Antwort"));

const deleteSessionContentItems = async (
	ctx: MutationCtx,
	sessionId: Id<"learningPlanSessions">,
) => {
	const items = await listItems(ctx, sessionId);
	for (const item of items) {
		await ctx.db.delete("learningSessionContentItems", item._id);
	}
};

export const getSessionGenerationContext = internalQuery({
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
		const documents = await ctx.db
			.query("learningPlanDocuments")
			.withIndex("by_learningPlanId", (q) =>
				q.eq("learningPlanId", session.learningPlanId),
			)
			.take(20);
		const answers = await ctx.db
			.query("learningPlanAnswers")
			.withIndex("by_learningPlanId", (q) =>
				q.eq("learningPlanId", session.learningPlanId),
			)
			.order("asc")
			.take(20);
		const learningTimes = await ctx.db
			.query("userLearningTimes")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(50);
		const existingItems = await listItems(ctx, args.sessionId);
		const planSessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", session.learningPlanId),
			)
			.order("asc")
			.take(20);
		const priorTheoryCards: Array<{ front: string; back: string }> = [];
		for (const planSession of planSessions) {
			if (
				planSession.sortOrder >= session.sortOrder ||
				planSession.phase !== "theory"
			) {
				continue;
			}

			const items = await listItems(ctx, planSession._id);
			for (const item of items) {
				if (item.kind !== "learnCard") continue;
				priorTheoryCards.push({
					front: item.front ?? item.prompt,
					back: item.back ?? item.idealAnswer,
				});
				if (priorTheoryCards.length >= 24) break;
			}
			if (priorTheoryCards.length >= 24) break;
		}

		return {
			plan,
			session,
			planSessions: planSessions.map((planSession) => ({
				phase: planSession.phase,
				title: planSession.title,
				goal: planSession.goal,
				sortOrder: planSession.sortOrder,
			})),
			documents,
			answers,
			learningTimes,
			priorTheoryCards,
			existingItemCount: existingItems.length,
			needsLegacyContentReplacement:
				existingItems.some(isLegacyTheoryItem) ||
				existingItems.some(isLegacyTaskItem),
			accessKey: `learningPlan:${session.learningPlanId}`,
		};
	},
});

export const storeGeneratedSessionContent = internalMutation({
	args: {
		sessionId: v.id("learningPlanSessions"),
		items: v.array(generatedSessionContentItemValidator),
		replaceExisting: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const session = await getOwnedSession(
			ctx,
			args.sessionId,
			ownerTokenIdentifier,
		);
		const existingItems = await listItems(ctx, args.sessionId);
		if (existingItems.length > 0 && args.replaceExisting !== true) {
			return { itemCount: existingItems.length };
		}

		if (existingItems.length > 0) {
			await deleteSessionContentItems(ctx, args.sessionId);
		}

		await insertGeneratedItemsForSession(ctx, session, args.items);
		const storedItems = await listItems(ctx, args.sessionId);
		return { itemCount: storedItems.length };
	},
});

export const ensureFallbackSessionContent = internalMutation({
	args: {
		sessionId: v.id("learningPlanSessions"),
		replaceExisting: v.optional(v.boolean()),
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

		if (args.replaceExisting === true) {
			await deleteSessionContentItems(ctx, args.sessionId);
		}

		const items = await ensureItemsForSession(ctx, session, plan);
		return { itemCount: items.length };
	},
});

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
				executionStatus: getSessionExecutionStatus(session),
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
		const result = buildAnalysis(session, items, attempts);
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
