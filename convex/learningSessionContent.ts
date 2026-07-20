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
import {
	createLearningContentPlan,
	type LearningQuestionBlueprint,
	type LearningTopic,
} from "./learningContentPlan";
import { getLearningSessionComposition } from "./learningSessionComposition";
import {
	MAX_MULTIPLE_CHOICE_OPTION_CHARS,
	MAX_MULTIPLE_CHOICE_PROMPT_CHARS,
} from "./learningSessionContentConstraints";
import {
	focusLearningTopics,
	normalizeLearningTopics,
} from "./learningTopicMap";
import { type TheoryContent, theoryContentValidator } from "./theoryContent";

type SessionContentItemKind =
	| "learnCard"
	| "multipleChoice"
	| "written"
	| "voice";
type AnswerRating = "notCorrect" | "partiallyCorrect" | "correct";

type GeneratedItem = {
	phase?: "theory" | "practice" | "rehearsal";
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
	learningBlockIndex?: number;
	topicId?: string;
	questionAngle?: string;
	coverageKey?: string;
	estimatedSeconds?: number;
};

const generatedChoiceValidator = v.object({
	id: v.string(),
	text: v.string(),
});

const generatedSessionContentItemValidator = v.object({
	phase: v.optional(
		v.union(v.literal("theory"), v.literal("practice"), v.literal("rehearsal")),
	),
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
	learningBlockIndex: v.optional(v.number()),
	topicId: v.optional(v.string()),
	questionAngle: v.optional(v.string()),
	coverageKey: v.optional(v.string()),
	estimatedSeconds: v.optional(v.number()),
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
	learningBlockIndex: item.learningBlockIndex ?? 0,
	topicId: item.topicId ?? item.title,
	questionAngle: item.questionAngle ?? "legacy",
	coverageKey: item.coverageKey ?? `${item._id}`,
	estimatedSeconds: item.estimatedSeconds ?? 40,
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

const compactToLength = (value: string, maxChars: number) => {
	const normalized = normalizeText(value);
	if (normalized.length <= maxChars) return normalized;

	const clipped = normalized.slice(0, maxChars - 1).trimEnd();
	const lastSpace = clipped.lastIndexOf(" ");
	const boundary =
		lastSpace >= Math.floor(maxChars * 0.6) ? lastSpace : clipped.length;
	return `${clipped.slice(0, boundary).trimEnd()}…`;
};

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

const getSessionTopics = (
	plan: Doc<"learningPlans">,
	session: Doc<"learningPlanSessions">,
): LearningTopic[] => {
	const focusTopics = (topics: LearningTopic[]) =>
		focusLearningTopics({
			topics,
			strengths: plan.insight?.strengths ?? [],
			gaps: plan.insight?.gaps ?? [],
		});
	if (plan.topicMap && plan.topicMap.length > 0) {
		return focusTopics(plan.topicMap);
	}

	return focusTopics(
		normalizeLearningTopics(
			distinct([
				plan.topicDescription,
				session.goal,
				...session.tasks,
				session.expectedOutcome,
				...(plan.insight?.gaps ?? []),
			])
				.slice(0, 12)
				.map((title, index) => ({
					title,
					learningGoal:
						session.tasks[index % Math.max(session.tasks.length, 1)] ??
						session.goal,
					keywords: extractKeywords([title, session.goal]),
					priority: index < 3 ? ("high" as const) : ("medium" as const),
				})),
		),
	);
};

const theoryQuestionFor = (
	blueprint: LearningQuestionBlueprint,
	variant: number,
) => {
	const topic = blueprint.topic.title;
	const learningGoal = blueprint.topic.learningGoal.replace(/[.!?]+$/, "");
	const variation =
		variant === 0 ? "" : ` Nenne eine neue Variante ${variant + 1}.`;
	switch (blueprint.angle) {
		case "recall":
			return `Wie erklärst du ${topic}, damit du dieses Lernziel erreichst: ${learningGoal}?${variation}`;
		case "recognize":
			return `Welche Merkmale prüfst du bei ${topic}, um Folgendes sicher zu können: ${learningGoal}?${variation}`;
		case "apply":
			return `Wie setzt du ${topic} an einem konkreten Beispiel um: ${learningGoal}?${variation}`;
		case "findError":
			return `Welcher typische Fehler verhindert bei ${topic} dieses Lernziel: ${learningGoal}?${variation}`;
		case "compare":
			return `Vergleiche zwei Lösungswege zu ${topic}: Welcher erfüllt dieses Lernziel besser – ${learningGoal}?${variation}`;
		case "examTransfer":
			return `Wie zeigst du in einer Prüfungsaufgabe zu ${topic}, dass du Folgendes kannst: ${learningGoal}?${variation}`;
	}
};

const buildTheoryItems = (
	plan: Doc<"learningPlans">,
	session: Doc<"learningPlanSessions">,
	questions: LearningQuestionBlueprint[],
) => {
	return questions.map((blueprint, index): GeneratedItem => {
		const concept = blueprint.topic.title;
		const keywords = extractKeywords([
			concept,
			blueprint.topic.learningGoal,
			...blueprint.topic.keywords,
			session.goal,
			session.expectedOutcome,
			plan.topicDescription,
		]);
		const detail =
			session.tasks[index % Math.max(session.tasks.length, 1)] ??
			session.expectedOutcome;
		const variant = Number(blueprint.coverageKey.split(":").at(-1) ?? 0);
		const front = theoryQuestionFor(blueprint, variant);
		const example = compact(`Nutze "${detail}" als kurzes Beispiel.`, detail);
		const commonMistake = compact(
			"Eine Umformung oder Begründung auslassen.",
			"Begründe jeden Schritt.",
		);
		const explanation = compact(
			`${concept}: ${blueprint.topic.learningGoal}`,
			session.goal,
		);
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
			topicId: blueprint.topic.id,
			questionAngle: blueprint.angle,
			coverageKey: blueprint.coverageKey,
			estimatedSeconds: blueprint.estimatedSeconds,
		};
	});
};

const buildTaskItems = (
	plan: Doc<"learningPlans">,
	session: Doc<"learningPlanSessions">,
	questions: LearningQuestionBlueprint[],
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
	const isPraxis = session.phase === "rehearsal";
	const phasePrefix = isPraxis ? "Generalprobe" : "Übung";

	return questions.map((blueprint, index): GeneratedItem => {
		const kind = blueprint.kind as SessionContentItemKind;
		const task = focusTasks[index % focusTasks.length] ?? session.goal;
		const topicTask = `${blueprint.topic.title}: ${task}`;
		const variant = Number(blueprint.coverageKey.split(":").at(-1) ?? 0) + 1;
		const learningGoal = blueprint.topic.learningGoal.replace(/[.!?]+$/, "");
		const freshTask = (() => {
			switch (blueprint.angle) {
				case "recall":
					return `Erkläre die entscheidende Regel zu ${blueprint.topic.title}: ${learningGoal}`;
				case "recognize":
					return `Erkenne die relevanten Merkmale von ${blueprint.topic.title}, um dieses Ziel zu erreichen: ${learningGoal}`;
				case "apply":
					return `Wende ${blueprint.topic.title} in einer neuen Aufgabe an: ${learningGoal}`;
				case "findError":
					return `Finde und korrigiere einen typischen Fehler bei ${blueprint.topic.title}: ${learningGoal}`;
				case "compare":
					return `Vergleiche zwei Lösungswege zu ${blueprint.topic.title} mit Blick auf dieses Ziel: ${learningGoal}`;
				case "examTransfer":
					return `Übertrage ${blueprint.topic.title} auf eine neue Prüfungsaufgabe: ${learningGoal}`;
			}
		})();
		const freshTaskVariant = `Variante ${variant}: ${freshTask}`;
		const title =
			kind === "multipleChoice"
				? "Auswahlfrage"
				: kind === "voice"
					? "Sprachaufgabe"
					: "Schreibaufgabe";
		const idealAnswer = compact(
			`${topicTask} Löse die Aufgabe knapp, begründe den entscheidenden Schritt und prüfe dein Ergebnis mit Bezug auf ${plan.topicDescription}.`,
			session.expectedOutcome,
		);

		if (kind === "multipleChoice") {
			const prompt = `${phasePrefix}: Welche Lösungsidee passt zu "${freshTaskVariant}"?`;
			return {
				kind,
				title,
				prompt: compactToLength(prompt, MAX_MULTIPLE_CHOICE_PROMPT_CHARS),
				explanation:
					"Die richtige Antwort verbindet den passenden Rechenschritt mit einer Kontrolle des Ergebnisses.",
				idealAnswer,
				choices: [
					{
						id: "correct",
						text: compactToLength(
							"Passenden Schritt ausführen, begründen und mit einer Probe prüfen.",
							MAX_MULTIPLE_CHOICE_OPTION_CHARS,
						),
					},
					{
						id: "distractor-fast",
						text: "Ergebnis direkt raten und Zwischenschritte auslassen.",
					},
					{
						id: "distractor-skip",
						text: "Kontrolle weglassen, wenn das Ergebnis ungefähr passt.",
					},
				],
				correctChoiceId: "correct",
				evaluationKeywords: keywords,
				topicId: blueprint.topic.id,
				questionAngle: blueprint.angle,
				coverageKey: blueprint.coverageKey,
				estimatedSeconds: blueprint.estimatedSeconds,
			};
		}

		return {
			kind,
			title,
			prompt:
				kind === "voice"
					? `${phasePrefix}: Erkläre laut deinen Lösungsweg zu "${freshTaskVariant}".`
					: `${phasePrefix}: Löse "${freshTaskVariant}" schriftlich und notiere die Probe.`,
			explanation:
				"Eine starke Antwort nennt den vollständigen Lösungsweg, vermeidet typische Fehler und kontrolliert das Ergebnis.",
			idealAnswer,
			evaluationKeywords: keywords,
			topicId: blueprint.topic.id,
			questionAngle: blueprint.angle,
			coverageKey: blueprint.coverageKey,
			estimatedSeconds: blueprint.estimatedSeconds,
		};
	});
};

const buildGeneratedItems = (
	plan: Doc<"learningPlans">,
	session: Doc<"learningPlanSessions">,
) => {
	const segments = getLearningSessionComposition({
		phase: session.phase,
		durationMinutes: session.durationMinutes,
		variant: session.compositionVariant ?? "control",
	});
	const contentPlan = createLearningContentPlan({
		segments,
		topics: getSessionTopics(plan, session),
	});

	return contentPlan.blocks.flatMap((block) => {
		const segmentSession: Doc<"learningPlanSessions"> = {
			...session,
			phase: block.phase,
			durationMinutes: block.durationMinutes,
		};
		const items =
			block.phase === "theory"
				? buildTheoryItems(plan, segmentSession, block.questions)
				: buildTaskItems(plan, segmentSession, block.questions);
		return items.map((item) => ({
			...item,
			phase: block.phase,
			learningBlockIndex: block.index,
		}));
	});
};

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
		.take(100);

const insertGeneratedItemsForSession = async (
	ctx: MutationCtx,
	session: Doc<"learningPlanSessions">,
	items: GeneratedItem[],
	sortOrderOffset = 0,
) => {
	const now = Date.now();
	for (const [index, item] of items.entries()) {
		await ctx.db.insert("learningSessionContentItems", {
			ownerTokenIdentifier: session.ownerTokenIdentifier,
			learningPlanId: session.learningPlanId,
			sessionId: session._id,
			phase: item.phase ?? session.phase,
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
			learningBlockIndex: item.learningBlockIndex,
			topicId: item.topicId,
			questionAngle: item.questionAngle,
			coverageKey: item.coverageKey,
			estimatedSeconds: item.estimatedSeconds,
			sortOrder: sortOrderOffset + index,
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
		const priorSessionItems: Array<{ prompt: string; coverageKey?: string }> =
			[];
		const priorCoverageKeys: string[] = [];
		for (const planSession of planSessions) {
			if (planSession._id === session._id) continue;
			const wasCompleted =
				planSession.executionStatus === "completed" || planSession.completed;
			if (planSession.sortOrder >= session.sortOrder && !wasCompleted) continue;

			const items = await listItems(ctx, planSession._id);
			for (const item of items) {
				if (item.coverageKey && priorCoverageKeys.length < 2_000) {
					priorCoverageKeys.push(item.coverageKey);
				}
				if (priorSessionItems.length < 100) {
					priorSessionItems.push({
						prompt: item.prompt,
						coverageKey: item.coverageKey,
					});
				}
				if (item.kind === "learnCard" && priorTheoryCards.length < 24) {
					priorTheoryCards.push({
						front: item.front ?? item.prompt,
						back: item.back ?? item.idealAnswer,
					});
				}
			}
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
			priorSessionItems,
			priorCoverageKeys,
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
		const plan = await getOwnedPlan(
			ctx,
			session.learningPlanId,
			ownerTokenIdentifier,
		);
		const existingItems = await listItems(ctx, args.sessionId);
		if (existingItems.length > 0 && args.replaceExisting !== true) {
			return { itemCount: existingItems.length };
		}

		if (existingItems.length > 0) {
			await deleteSessionContentItems(ctx, args.sessionId);
		}

		const composition = getLearningSessionComposition({
			phase: session.phase,
			durationMinutes: session.durationMinutes,
			variant: session.compositionVariant ?? "control",
		});
		const practiceSegment = composition.find(
			(segment) => segment.phase === "practice",
		);
		const hasGeneratedPractice = args.items.some(
			(item) => item.phase === "practice",
		);
		const practiceBlocks = practiceSegment
			? createLearningContentPlan({
					segments: composition,
					topics: getSessionTopics(plan, session),
				}).blocks.filter((block) => block.phase === "practice")
			: [];
		const items =
			practiceBlocks.length > 0 && !hasGeneratedPractice
				? [
						...args.items,
						...practiceBlocks.flatMap((block) =>
							buildTaskItems(
								plan,
								{
									...session,
									phase: "practice",
									durationMinutes: block.durationMinutes,
								},
								block.questions,
							).map((item) => ({
								...item,
								phase: "practice" as const,
								learningBlockIndex: block.index,
							})),
						),
					]
				: args.items;

		await insertGeneratedItemsForSession(ctx, session, items);
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

export const extendSessionContent = mutation({
	args: {
		sessionId: v.id("learningPlanSessions"),
		durationMinutes: v.number(),
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
		if (
			!Number.isInteger(args.durationMinutes) ||
			args.durationMinutes < 5 ||
			args.durationMinutes > 10
		) {
			throwUserFacingError(
				"Weiterlernen muss zwischen 5 und 10 Minuten dauern.",
			);
		}

		const existingItems = await listItems(ctx, args.sessionId);
		const lastItem = existingItems.at(-1);
		const continuationPhase = lastItem?.phase ?? session.phase;
		const nextBlockIndex =
			Math.max(
				-1,
				...existingItems.map((item) => item.learningBlockIndex ?? 0),
			) + 1;
		const contentPlan = createLearningContentPlan({
			segments: [
				{
					phase: continuationPhase,
					durationMinutes: args.durationMinutes,
				},
			],
			topics: getSessionTopics(plan, session),
			excludedCoverageKeys: existingItems
				.map((item) => item.coverageKey)
				.filter((key): key is string => Boolean(key)),
			blockIndexOffset: nextBlockIndex,
		});
		const newItems = contentPlan.blocks.flatMap((block) => {
			const blockSession: Doc<"learningPlanSessions"> = {
				...session,
				phase: block.phase,
				durationMinutes: block.durationMinutes,
			};
			const items =
				block.phase === "theory"
					? buildTheoryItems(plan, blockSession, block.questions)
					: buildTaskItems(plan, blockSession, block.questions);
			return items.map((item) => ({
				...item,
				phase: block.phase,
				learningBlockIndex: block.index,
			}));
		});

		if (existingItems.length + newItems.length > 100) {
			throwUserFacingError(
				"Für diese Lernsession wurden bereits genug Zusatzfragen erstellt.",
			);
		}

		await insertGeneratedItemsForSession(
			ctx,
			session,
			newItems,
			existingItems.length,
		);
		return {
			firstNewItemIndex: existingItems.length,
			addedItemCount: newItems.length,
			durationMinutes: args.durationMinutes,
		};
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
				compositionVariant: session.compositionVariant ?? "control",
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
