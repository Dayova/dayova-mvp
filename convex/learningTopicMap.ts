import { v } from "convex/values";
import { normalizeGeneratedGermanText } from "./generatedGermanText";
import type {
	LearningTopic,
	LearningTopicPriority,
} from "./learningContentPlan";

export const MAX_LEARNING_TOPIC_COUNT = 12;
export const MAX_LEARNING_TOPIC_KEYWORD_COUNT = 8;

export const learningTopicPriorityValidator = v.union(
	v.literal("high"),
	v.literal("medium"),
	v.literal("low"),
);

export const learningTopicValidator = v.object({
	id: v.string(),
	title: v.string(),
	learningGoal: v.string(),
	keywords: v.array(v.string()),
	priority: learningTopicPriorityValidator,
});

const normalizeTopicId = (value: string, index: number) => {
	const normalized = value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/ß/g, "ss")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
	return normalized || `thema-${index + 1}`;
};

export const normalizeLearningTopics = (
	topics: Array<{
		id?: string;
		title: string;
		learningGoal: string;
		keywords: string[];
		priority: LearningTopicPriority;
	}>,
): LearningTopic[] => {
	const usedIds = new Set<string>();
	return topics.slice(0, MAX_LEARNING_TOPIC_COUNT).map((topic, index) => {
		const title = normalizeGeneratedGermanText(topic.title);
		const baseId = normalizeTopicId(topic.id || title, index);
		let id = baseId;
		let suffix = 2;
		while (usedIds.has(id)) {
			id = `${baseId}-${suffix}`;
			suffix += 1;
		}
		usedIds.add(id);

		return {
			id,
			title,
			learningGoal: normalizeGeneratedGermanText(topic.learningGoal),
			keywords: topic.keywords
				.map((keyword) => normalizeGeneratedGermanText(keyword))
				.filter(Boolean)
				.slice(0, MAX_LEARNING_TOPIC_KEYWORD_COUNT),
			priority: topic.priority,
		};
	});
};

const focusStopWords = new Set([
	"aber",
	"auch",
	"dass",
	"eine",
	"einer",
	"eines",
	"oder",
	"sicher",
	"sowie",
	"und",
	"werden",
]);

const focusTokens = (values: string[]) =>
	Array.from(
		new Set(
			values
				.join(" ")
				.normalize("NFKD")
				.replace(/[\u0300-\u036f]/g, "")
				.toLowerCase()
				.match(/[a-z0-9]+/g)
				?.filter((token) => token.length >= 4 && !focusStopWords.has(token)) ??
				[],
		),
	);

const hasTopicOverlap = (topicTokens: string[], insightTokens: string[]) =>
	topicTokens.some((topicToken) =>
		insightTokens.some(
			(insightToken) =>
				topicToken.includes(insightToken) ||
				insightToken.includes(topicToken) ||
				(topicToken.length >= 6 &&
					insightToken.length >= 6 &&
					topicToken.slice(0, 6) === insightToken.slice(0, 6)),
		),
	);

export const focusLearningTopics = ({
	topics,
	strengths,
	gaps,
}: {
	topics: LearningTopic[];
	strengths: string[];
	gaps: string[];
}): LearningTopic[] => {
	const normalizedTopics = normalizeLearningTopics(topics);
	if (strengths.length === 0) return normalizedTopics;

	const strengthTokens = focusTokens(strengths);
	const gapTokens = focusTokens(gaps);
	const retainedTopics = normalizedTopics
		.filter((topic) => {
			const topicTokens = focusTokens([
				topic.title,
				topic.learningGoal,
				...topic.keywords,
			]);
			return !hasTopicOverlap(topicTokens, strengthTokens);
		})
		.map((topic) => {
			const topicTokens = focusTokens([
				topic.title,
				topic.learningGoal,
				...topic.keywords,
			]);
			return hasTopicOverlap(topicTokens, gapTokens)
				? { ...topic, priority: "high" as const }
				: topic;
		});

	const uncoveredGaps = gaps.filter((gap) => {
		const gapEntryTokens = focusTokens([gap]);
		return !retainedTopics.some((topic) =>
			hasTopicOverlap(
				focusTokens([topic.title, topic.learningGoal, ...topic.keywords]),
				gapEntryTokens,
			),
		);
	});
	if (retainedTopics.length === 0 && uncoveredGaps.length === 0) {
		return normalizeLearningTopics(
			strengths.map((strength) => ({
				title: `Prüfungstransfer: ${strength}`,
				learningGoal: `Wende ${strength} in einer neuen, komplexeren Prüfungsaufgabe an und begründe den Lösungsweg.`,
				keywords: focusTokens([strength, "Prüfungstransfer"]),
				priority: "high" as const,
			})),
		);
	}

	return normalizeLearningTopics([
		...retainedTopics,
		...uncoveredGaps.map((gap) => ({
			title: gap,
			learningGoal: gap,
			keywords: focusTokens([gap]),
			priority: "high" as const,
		})),
	]);
};
