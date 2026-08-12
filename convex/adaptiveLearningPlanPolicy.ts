import type {
	LearningEvidenceDimension,
	LearningTopic,
} from "./learningContentPlan";

export type AdaptiveEvidenceRating =
	| "notCorrect"
	| "partiallyCorrect"
	| "correct";

export type AdaptiveTopicEvidence = {
	topicId: string;
	dimension: LearningEvidenceDimension;
	rating: AdaptiveEvidenceRating;
	sessionId: string;
	createdAt: number;
};

export type AdaptiveTargetHistory = {
	topicId: string;
	dimension: LearningEvidenceDimension;
	targetedAt: number;
};

export type AdaptiveLearningTarget = {
	topicId: string;
	topicTitle: string;
	learningGoal: string;
	dimension: LearningEvidenceDimension;
	phase: "theory" | "practice" | "rehearsal";
	status: "unknown" | "developing";
	needsControlCheck: boolean;
	reason: string;
};

const evidenceDimensions: LearningEvidenceDimension[] = [
	"understanding",
	"problemSolving",
	"independent",
];

const dimensionRank: Record<LearningEvidenceDimension, number> = {
	understanding: 0,
	problemSolving: 1,
	independent: 2,
};

const requiredCorrectSessionCount: Record<LearningEvidenceDimension, number> = {
	understanding: 2,
	problemSolving: 1,
	independent: 1,
};

const ratingRank: Record<AdaptiveEvidenceRating, number> = {
	notCorrect: 0,
	partiallyCorrect: 1,
	correct: 2,
};

const priorityRank = { high: 0, medium: 1, low: 2 } as const;

const dimensionLabel: Record<LearningEvidenceDimension, string> = {
	understanding: "Verstehen",
	problemSolving: "Problemlösen",
	independent: "selbstständiges Lösen",
};

const phaseForDimension: Record<
	LearningEvidenceDimension,
	AdaptiveLearningTarget["phase"]
> = {
	understanding: "theory",
	problemSolving: "practice",
	independent: "rehearsal",
};

const evidenceAppliesToDimension = (
	evidence: AdaptiveTopicEvidence,
	dimension: LearningEvidenceDimension,
) =>
	evidence.dimension === dimension ||
	(evidence.rating === "correct" &&
		dimensionRank[evidence.dimension] > dimensionRank[dimension]);

const collapseEvidenceBySession = (evidence: AdaptiveTopicEvidence[]) => {
	const bySessionId = new Map<string, AdaptiveTopicEvidence>();
	for (const entry of evidence) {
		const existing = bySessionId.get(entry.sessionId);
		if (!existing) {
			bySessionId.set(entry.sessionId, entry);
			continue;
		}
		bySessionId.set(entry.sessionId, {
			...existing,
			rating:
				ratingRank[entry.rating] < ratingRank[existing.rating]
					? entry.rating
					: existing.rating,
			createdAt: Math.max(existing.createdAt, entry.createdAt),
		});
	}
	return Array.from(bySessionId.values());
};

export const deriveAdaptiveDimensionStatus = (args: {
	dimension: LearningEvidenceDimension;
	initialStatus: "secure" | "developing" | "unknown";
	evidence: AdaptiveTopicEvidence[];
}) => {
	const relevantEvidence = collapseEvidenceBySession(
		args.evidence.filter((entry) =>
			evidenceAppliesToDimension(entry, args.dimension),
		),
	).sort((left, right) => right.createdAt - left.createdAt);
	const requiredCorrectSessions = requiredCorrectSessionCount[args.dimension];
	const initialEvidenceCount =
		args.dimension === "understanding"
			? args.initialStatus === "secure"
				? requiredCorrectSessions
				: args.initialStatus === "developing"
					? 1
					: 0
			: 0;
	const correctOccasions = new Set(
		relevantEvidence
			.filter((entry) => entry.rating === "correct")
			.map((entry) => entry.sessionId),
	).size;
	const latest = relevantEvidence[0];
	const priorCorrectOccasions = new Set(
		relevantEvidence
			.slice(1)
			.filter((entry) => entry.rating === "correct")
			.map((entry) => entry.sessionId),
	).size;
	const evidenceCount = relevantEvidence.length + initialEvidenceCount;
	const status =
		(args.dimension === "understanding" &&
			args.initialStatus === "secure" &&
			relevantEvidence.length === 0) ||
		(latest?.rating === "correct" &&
			correctOccasions + initialEvidenceCount >= requiredCorrectSessions)
			? ("secure" as const)
			: evidenceCount > 0
				? ("developing" as const)
				: ("unknown" as const);
	const needsControlCheck =
		Boolean(latest && latest.rating !== "correct") &&
		priorCorrectOccasions + initialEvidenceCount >= requiredCorrectSessions;

	return { status, needsControlCheck, evidenceCount };
};

const requiredDimensionsForTopic = (topic: LearningTopic) =>
	topic.requiredEvidenceDimensions?.length
		? evidenceDimensions.filter((dimension) =>
				topic.requiredEvidenceDimensions?.includes(dimension),
			)
		: evidenceDimensions;

const reasonForTarget = (
	topicTitle: string,
	dimension: LearningEvidenceDimension,
	status: "unknown" | "developing",
	needsControlCheck: boolean,
) => {
	if (needsControlCheck) {
		return `Kontrollcheck: Neue Evidenz zu „${topicTitle}“ widerspricht früheren sicheren Lösungen.`;
	}
	if (status === "unknown") {
		return `Für „${topicTitle}“ fehlt noch Evidenz im ${dimensionLabel[dimension]}.`;
	}
	return `„${topicTitle}“ ist im ${dimensionLabel[dimension]} noch nicht stabil.`;
};

export const selectNextAdaptiveLearningTarget = (args: {
	topics: LearningTopic[];
	initialReadiness: Array<{
		topicId: string;
		status: "secure" | "developing" | "unknown";
	}>;
	evidence: AdaptiveTopicEvidence[];
	history?: AdaptiveTargetHistory[];
	excludeTargetKeys?: string[];
}): AdaptiveLearningTarget | null => {
	const readinessByTopicId = new Map(
		args.initialReadiness.map((entry) => [entry.topicId, entry.status]),
	);
	const latestTargetedAtByKey = new Map<string, number>();
	for (const entry of args.history ?? []) {
		const key = `${entry.topicId}:${entry.dimension}`;
		latestTargetedAtByKey.set(
			key,
			Math.max(latestTargetedAtByKey.get(key) ?? 0, entry.targetedAt),
		);
	}
	const latestHistoryEntry = (args.history ?? []).reduce<
		AdaptiveTargetHistory | undefined
	>(
		(latest, entry) =>
			!latest || entry.targetedAt > latest.targetedAt ? entry : latest,
		undefined,
	);
	const excludedTargetKeys = new Set(args.excludeTargetKeys ?? []);
	const candidates = args.topics.flatMap((topic) => {
		const requiredDimensions = requiredDimensionsForTopic(topic);
		const topicEvidence = args.evidence.filter(
			(entry) => entry.topicId === topic.id,
		);
		return requiredDimensions.flatMap((dimension) => {
			const key = `${topic.id}:${dimension}`;
			if (excludedTargetKeys.has(key)) return [];
			const lastTargetedAt = latestTargetedAtByKey.get(key) ?? 0;
			const dimensionStatus = deriveAdaptiveDimensionStatus({
				dimension,
				initialStatus: readinessByTopicId.get(topic.id) ?? "unknown",
				evidence: topicEvidence,
			});
			if (dimensionStatus.status === "secure") return [];
			if (
				dimension === "understanding" &&
				lastTargetedAt > 0 &&
				!dimensionStatus.needsControlCheck
			) {
				return [];
			}
			const status: "unknown" | "developing" = dimensionStatus.status;

			return [
				{
					topic,
					dimension,
					...dimensionStatus,
					status,
					lastTargetedAt,
					isImmediateGuidedFollowUp:
						latestHistoryEntry?.dimension === "understanding" &&
						latestHistoryEntry.topicId === topic.id &&
						dimension === "problemSolving",
				},
			];
		});
	});

	candidates.sort(
		(left, right) =>
			Number(right.needsControlCheck) - Number(left.needsControlCheck) ||
			Number(right.isImmediateGuidedFollowUp) -
				Number(left.isImmediateGuidedFollowUp) ||
			priorityRank[left.topic.priority] - priorityRank[right.topic.priority] ||
			dimensionRank[left.dimension] - dimensionRank[right.dimension] ||
			left.lastTargetedAt - right.lastTargetedAt ||
			left.evidenceCount - right.evidenceCount ||
			left.topic.title.localeCompare(right.topic.title, "de"),
	);
	const selected = candidates[0];
	if (!selected) return null;

	return {
		topicId: selected.topic.id,
		topicTitle: selected.topic.title,
		learningGoal: selected.topic.learningGoal,
		dimension: selected.dimension,
		phase: selected.needsControlCheck
			? "practice"
			: phaseForDimension[selected.dimension],
		status: selected.status,
		needsControlCheck: selected.needsControlCheck,
		reason: reasonForTarget(
			selected.topic.title,
			selected.dimension,
			selected.status,
			selected.needsControlCheck,
		),
	};
};

export const selectAdaptiveMaintenanceTarget = (args: {
	topics: LearningTopic[];
	history?: AdaptiveTargetHistory[];
	excludeTargetKeys?: string[];
}): AdaptiveLearningTarget | null => {
	const excludedTargetKeys = new Set(args.excludeTargetKeys ?? []);
	const latestTargetedAtByKey = new Map<string, number>();
	for (const entry of args.history ?? []) {
		const key = `${entry.topicId}:${entry.dimension}`;
		latestTargetedAtByKey.set(
			key,
			Math.max(latestTargetedAtByKey.get(key) ?? 0, entry.targetedAt),
		);
	}
	const candidates = args.topics.flatMap((topic) => {
		const requiredDimensions = requiredDimensionsForTopic(topic);
		return requiredDimensions.flatMap((dimension) => {
			const key = `${topic.id}:${dimension}`;
			return excludedTargetKeys.has(key)
				? []
				: [
						{
							topic,
							dimension,
							lastTargetedAt: latestTargetedAtByKey.get(key) ?? 0,
						},
					];
		});
	});
	candidates.sort(
		(left, right) =>
			left.lastTargetedAt - right.lastTargetedAt ||
			priorityRank[left.topic.priority] - priorityRank[right.topic.priority] ||
			dimensionRank[right.dimension] - dimensionRank[left.dimension] ||
			left.topic.title.localeCompare(right.topic.title, "de"),
	);
	const selected = candidates[0];
	if (!selected) return null;
	return {
		topicId: selected.topic.id,
		topicTitle: selected.topic.title,
		learningGoal: selected.topic.learningGoal,
		dimension: selected.dimension,
		phase: phaseForDimension[selected.dimension],
		status: "developing",
		needsControlCheck: false,
		reason: `„${selected.topic.title}“ wird bis zur Prüfung mit einer kurzen Wiederholung sicher gehalten.`,
	};
};

export const adaptiveSessionCopy = (target: AdaptiveLearningTarget) => {
	if (target.needsControlCheck) {
		return {
			title: target.topicTitle,
			goal: `Prüfe deinen Wissensstand zu ${target.topicTitle} mit einer neuen Aufgabe.`,
			tasks: [
				"Eine neue Kontrollfrage ohne Vorlage beantworten",
				"Antwort begründen und Ergebnis prüfen",
			],
			expectedOutcome: `Eine neue Antwort klärt, wie sicher du ${target.topicTitle} aktuell beherrschst.`,
		};
	}
	if (target.dimension === "understanding") {
		return {
			title: target.topicTitle,
			goal: `Verstehe ${target.topicTitle}: ${target.learningGoal}`,
			tasks: [
				"Kernidee an einem Beispiel nachvollziehen",
				"Verständnis ohne Vorlage erklären",
			],
			expectedOutcome: `Du kannst ${target.topicTitle} verständlich erklären.`,
		};
	}
	if (target.dimension === "problemSolving") {
		return {
			title: target.topicTitle,
			goal: `Löse Aufgaben zu ${target.topicTitle} mit einer passenden Strategie.`,
			tasks: [
				"Lösungsweg selbst auswählen",
				"Fehler finden und Ergebnis prüfen",
			],
			expectedOutcome: `Du löst neue Aufgaben zu ${target.topicTitle} begründet.`,
		};
	}
	return {
		title: target.topicTitle,
		goal: `Bearbeite ${target.topicTitle} selbstständig unter Prüfungsbedingungen.`,
		tasks: [
			"Prüfungsnahe Aufgabe ohne Hinweise lösen",
			"Ergebnis und Zeitbedarf kontrollieren",
		],
		expectedOutcome: `Du löst ${target.topicTitle} selbstständig und prüfungsnah.`,
	};
};
