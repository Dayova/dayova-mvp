import { describe, expect, test } from "vitest";
import {
	composeExamTopicDescription,
	parseTopicItemsParam,
	readExamTopicInput,
	validateExamTopicInput,
} from "./examTopicInput";

describe("separate topic selections and additional information", () => {
	test("retains a long legacy accounting list and legacy teacher guidance without guessing selections", () => {
		const text =
			"Buchhaltung, Inventur, Belege, Inventar, Vermögen, Bilanz\nUmsatzsteuer und Vorsteuer: Brutto- und Nettobeträge berechnen\n";
		expect(
			readExamTopicInput({
				topicDescription: text,
				teacherGuidance: "Ohne Hilfsmittel",
			}),
		).toEqual({
			topicItems: [],
			topicAdditionalInfo: `${text}\nOhne Hilfsmittel`,
		});
	});
	test("projects selected topics and additional information for existing AI/calendar consumers", () => {
		const input = {
			topicItems: ["Analytische Geometrie", "Vektoren"],
			topicAdditionalInfo: "Ohne Hilfsmittel\nNur Spiegelung an Ebenen",
		};
		const description = composeExamTopicDescription(input);
		expect(description).toBe(
			"Analytische Geometrie\nVektoren\nOhne Hilfsmittel\nNur Spiegelung an Ebenen",
		);
		expect(
			readExamTopicInput({ ...input, topicDescription: description }),
		).toEqual(input);
		expect(
			validateExamTopicInput({ ...input, topicDescription: description }),
		).toEqual({ ...input, topicDescription: description });
	});
	test("supports selections alone and uncatalogued text alone", () => {
		expect(
			composeExamTopicDescription({
				topicItems: ["Bilanz"],
				topicAdditionalInfo: "",
			}),
		).toBe("Bilanz");
		expect(
			composeExamTopicDescription({
				topicItems: [],
				topicAdditionalInfo: "Inventur\nBelege",
			}),
		).toBe("Inventur\nBelege");
	});
	test.each([
		["Bilanz", "bilanz"],
		[""],
		[" Bilanz ", "Bilanz"],
	])("rejects duplicate or empty choices %j", (...topicItems) => {
		expect(() =>
			validateExamTopicInput({
				topicItems,
				topicAdditionalInfo: "",
				topicDescription: topicItems.join("\n"),
			}),
		).toThrow("Bitte prüfe");
	});
	test("rejects divergent projection before persisting and tolerates old callers", () => {
		expect(() =>
			validateExamTopicInput({
				topicItems: ["Bilanz"],
				topicAdditionalInfo: "Ohne Hilfsmittel",
				topicDescription: "Inventur",
			}),
		).toThrow("stimmen nicht überein");
		expect(validateExamTopicInput({ topicDescription: " Inventur " })).toEqual({
			topicDescription: "Inventur",
		});
	});
	test("round trips delimiters inside a selected title rather than splitting them", () => {
		const input = {
			topicItems: ["Angebot, Nachfrage und Preis; Grundlagen"],
			topicAdditionalInfo: "Nur Seite 4–8",
		};
		expect(
			readExamTopicInput({
				...input,
				topicDescription: composeExamTopicDescription(input),
			}),
		).toEqual(input);
	});
	test("invalid route metadata falls back to the intact scope", () => {
		expect(parseTopicItemsParam('["Bilanz",7]')).toBeUndefined();
		expect(parseTopicItemsParam("not-json")).toBeUndefined();
		expect(parseTopicItemsParam('["Bilanz","bilanz"]')).toBeUndefined();
		expect(parseTopicItemsParam('["  "]')).toBeUndefined();
		expect(parseTopicItemsParam('["Bilanz"]')).toEqual(["Bilanz"]);
	});
});
