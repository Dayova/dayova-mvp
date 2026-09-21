import { describe, expect, test } from "vitest";
import type { SessionContentItem } from "./types";
import {
	adaptTheoryTopic,
	getTheoryPagePresentation,
	getTheoryTopicNavigation,
	runTheoryTopicPrimaryAction,
} from "./theory-topic";

const baseItem: SessionContentItem = {
	id: "content-item" as SessionContentItem["id"],
	sessionId: "session" as SessionContentItem["sessionId"],
	phase: "theory",
	kind: "learnCard",
	title: "Lineare Gleichungen",
	prompt: "Wie bleibt eine Gleichung im Gleichgewicht?",
	front: "Wie bleibt eine Gleichung im Gleichgewicht?",
	back: "Führe auf beiden Seiten dieselbe Operation aus.",
	explanation: "Führe auf beiden Seiten dieselbe Operation aus.",
	idealAnswer: "Was du links tust, tust du auch rechts.",
	choices: [],
	learningBlockIndex: 0,
	topicId: "lineare-gleichungen",
	questionAngle: "recall",
	coverageKey: "lineare-gleichungen:recall:0",
	estimatedSeconds: 40,
	sortOrder: 0,
};

describe("theory topic adaptation", () => {
	test("uses the structured theory contract when it is available", () => {
		const topic = adaptTheoryTopic(
			{
				...baseItem,
				theoryContent: {
					conceptTitle: "Äquivalenzumformungen",
					question: "Warum muss dieselbe Operation auf beiden Seiten stehen?",
					explanation:
						"Nur so bleibt die Lösungsmenge der Gleichung unverändert.",
					keyPoints: [
						"Addiere auf beiden Seiten dieselbe Zahl.",
						"Kontrolliere das Ergebnis mit einer Probe.",
					],
					example: "x + 3 = 7 wird durch −3 auf beiden Seiten zu x = 4.",
					memoryCue: "Beide Seiten bleiben im Gleichgewicht.",
					commonMistake: "Die Operation nur auf einer Seite ausführen.",
				},
			},
			0,
		);

		expect(topic).toEqual({
			conceptTitle: "Äquivalenzumformungen",
			question: "Warum muss dieselbe Operation auf beiden Seiten stehen?",
			explanation: "Nur so bleibt die Lösungsmenge der Gleichung unverändert.",
			keyPoints: [
				"Addiere auf beiden Seiten dieselbe Zahl.",
				"Kontrolliere das Ergebnis mit einer Probe.",
			],
			example: "x + 3 = 7 wird durch −3 auf beiden Seiten zu x = 4.",
			memoryCue: "Beide Seiten bleiben im Gleichgewicht.",
			commonMistake: "Die Operation nur auf einer Seite ausführen.",
		});
	});

	test("adapts existing learning cards without parsing their flattened answer", () => {
		const topic = adaptTheoryTopic(
			{
				...baseItem,
				title: "Lernkarte 1",
				theoryContent: undefined,
			},
			0,
		);

		expect(topic).toEqual({
			conceptTitle: "Thema 1",
			question: "Wie bleibt eine Gleichung im Gleichgewicht?",
			explanation: "Führe auf beiden Seiten dieselbe Operation aus.",
			keyPoints: [],
			example: undefined,
			memoryCue: "Was du links tust, tust du auch rechts.",
			commonMistake: undefined,
		});
	});
});

test("focused theory pages only expose the sections needed for their role", () => {
	expect(getTheoryPagePresentation("recall")).toMatchObject({
		sectionTitle: "Kernidee",
		showKeyPoints: true,
		showExample: false,
		showCommonMistake: false,
	});
	expect(getTheoryPagePresentation("apply")).toMatchObject({
		sectionTitle: "So funktioniert es",
		showKeyPoints: false,
		showExample: true,
		showMemoryCue: true,
	});
	expect(getTheoryPagePresentation("findError")).toMatchObject({
		sectionTitle: "Darauf musst du achten",
		showCommonMistake: true,
	});
});

describe("theory topic navigation", () => {
	test("disables previous on the first topic and advances with Weiter", () => {
		expect(getTheoryTopicNavigation(0, 3)).toEqual({
			canGoPrevious: false,
			isLastTopic: false,
			primaryLabel: "Weiter",
		});
	});

	test("marks the final topic as the completion action", () => {
		expect(getTheoryTopicNavigation(2, 3)).toEqual({
			canGoPrevious: true,
			isLastTopic: true,
			primaryLabel: "Theorie abschließen",
		});
	});

	test("runs completion instead of advancing on the final topic", () => {
		const advancedTo: number[] = [];
		let completionCount = 0;

		const action = runTheoryTopicPrimaryAction({
			currentIndex: 2,
			total: 3,
			onAdvance: (nextIndex) => advancedTo.push(nextIndex),
			onComplete: () => {
				completionCount += 1;
			},
		});

		expect(action).toBe("complete");
		expect(advancedTo).toEqual([]);
		expect(completionCount).toBe(1);
	});
});
