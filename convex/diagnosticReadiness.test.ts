import { expect, test } from "vitest";
import { deriveTopicReadiness } from "./diagnosticReadiness";

test("uses demonstrated keyword evidence instead of answer length", () => {
	const readiness = deriveTopicReadiness({
		topicIds: ["lineare-funktionen", "nullstellen"],
		questions: [
			{
				id: "q1",
				topicId: "lineare-funktionen",
				kind: "performance",
				evaluationKeywords: ["steigung", "y-achsenabschnitt"],
			},
			{
				id: "q2",
				topicId: "nullstellen",
				kind: "performance",
				evaluationKeywords: ["x gleich null", "schnittpunkt"],
			},
		],
		answers: [
			{
				questionId: "q1",
				answer: "Die Gerade hat eine Steigung und einen y-Achsenabschnitt.",
			},
			{
				questionId: "q2",
				answer:
					"Das ist eine sehr lange, flüssig formulierte, aber fachlich vollkommen falsche Antwort ohne relevante Begriffe.",
			},
		],
	});

	expect(readiness).toEqual([
		{ topicId: "lineare-funktionen", status: "secure" },
		{ topicId: "nullstellen", status: "unknown" },
	]);
});

test("keeps mixed performance evidence below secure", () => {
	const readiness = deriveTopicReadiness({
		topicIds: ["analysis"],
		questions: [
			{
				id: "q1",
				topicId: "analysis",
				kind: "performance",
				evaluationKeywords: ["ableitung", "steigung"],
			},
			{
				id: "q2",
				topicId: "analysis",
				kind: "performance",
				evaluationKeywords: ["extremstelle", "vorzeichenwechsel"],
			},
		],
		answers: [
			{ questionId: "q1", answer: "Die Ableitung beschreibt die Steigung." },
			{ questionId: "q2", answer: "Das weiß ich nicht." },
		],
	});

	expect(readiness).toEqual([{ topicId: "analysis", status: "developing" }]);
});

test("scores performance multiple choice against the explicit correct answer", () => {
	const wrongAnswer = deriveTopicReadiness({
		topicIds: ["quadratische-gleichungen"],
		questions: [
			{
				id: "q1",
				topicId: "quadratische-gleichungen",
				kind: "performance",
				responseKind: "multipleChoice",
				correctAnswer: "x = 2",
				evaluationKeywords: ["x", "2"],
			},
		],
		answers: [{ questionId: "q1", answer: "x = 2 oder x = -2" }],
	});
	const correctAnswer = deriveTopicReadiness({
		topicIds: ["quadratische-gleichungen"],
		questions: [
			{
				id: "q1",
				topicId: "quadratische-gleichungen",
				kind: "performance",
				responseKind: "multipleChoice",
				correctAnswer: "x = 2",
				evaluationKeywords: ["x", "2"],
			},
		],
		answers: [{ questionId: "q1", answer: "x = 2" }],
	});

	expect(wrongAnswer).toEqual([
		{ topicId: "quadratische-gleichungen", status: "unknown" },
	]);
	expect(correctAnswer).toEqual([
		{ topicId: "quadratische-gleichungen", status: "secure" },
	]);
});
