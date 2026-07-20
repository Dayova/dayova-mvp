import { expect, test } from "vitest";
import { focusLearningTopics } from "./learningTopicMap";

test("focuses content on gaps instead of replaying diagnosed strengths", () => {
	const focused = focusLearningTopics({
		topics: [
			{
				id: "cidr-masken",
				title: "CIDR-Notation und Masken",
				learningGoal: "CIDR-Präfixe sicher in Dezimalmasken umwandeln.",
				keywords: ["CIDR", "Subnetzmaske"],
				priority: "high",
			},
			{
				id: "fehleranalyse",
				title: "Fehlersuche in Konfigurationen",
				learningGoal: "Ungültige IP-Konfigurationen erkennen.",
				keywords: ["Fehler", "Konfiguration"],
				priority: "medium",
			},
		],
		strengths: ["CIDR zu Dezimalmasken"],
		gaps: ["Transfer auf Konfigurationsfehler"],
	});

	expect(focused.some((topic) => topic.id === "cidr-masken")).toBe(false);
	expect(focused).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ id: "fehleranalyse", priority: "high" }),
		]),
	);
});

test("keeps a harder related gap separate from a mastered basic topic", () => {
	const focused = focusLearningTopics({
		topics: [
			{
				id: "cidr-masken",
				title: "CIDR-Notation und Masken",
				learningGoal: "CIDR-Präfixe in Dezimalmasken umwandeln.",
				keywords: ["CIDR", "Subnetzmaske"],
				priority: "high",
			},
		],
		strengths: ["Sicherer Umgang mit CIDR-Präfixen und Subnetzmasken"],
		gaps: ["Komplexe VLSM-Szenarien mit variablen Subnetzmasken"],
	});

	expect(focused.some((topic) => topic.id === "cidr-masken")).toBe(false);
	expect(focused).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				title: "Komplexe VLSM-Szenarien mit variablen Subnetzmasken",
				priority: "high",
			}),
		]),
	);
});

test("turns all-strength diagnostics into advanced transfer topics", () => {
	const focused = focusLearningTopics({
		topics: [
			{
				id: "cidr-masken",
				title: "CIDR-Notation und Masken",
				learningGoal: "CIDR-Präfixe in Dezimalmasken umwandeln.",
				keywords: ["CIDR", "Subnetzmaske"],
				priority: "high",
			},
		],
		strengths: ["CIDR-Präfixe und Subnetzmasken sicher umrechnen"],
		gaps: [],
	});

	expect(focused).toHaveLength(1);
	expect(focused[0]).toMatchObject({
		title: "Prüfungstransfer: CIDR-Präfixe und Subnetzmasken sicher umrechnen",
		priority: "high",
	});
});
