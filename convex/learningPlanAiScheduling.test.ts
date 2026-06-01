import { describe, expect, test } from "vitest";
import { __testOnlyLearningPlanAi } from "./learningPlanAi";

const germanText = (text: string) => ({
	text,
	asciiShadow: text
		.replace(/ä/g, "ae")
		.replace(/ö/g, "oe")
		.replace(/ü/g, "ue")
		.replace(/Ä/g, "Ae")
		.replace(/Ö/g, "Oe")
		.replace(/Ü/g, "Ue")
		.replace(/ß/g, "ss"),
});

describe("learning plan AI scheduling", () => {
	test("uses only free stored learning times and hints when needed time is busy", () => {
		const result = __testOnlyLearningPlanAi.normalizeSessions(
			"2026-06-05",
			5,
			[
				{
					phase: "theory",
					title: germanText("Grundlagen"),
					dayOffsetBeforeExam: 3,
					startTime: "15:00",
					durationMinutes: 90,
					goal: germanText("Wiederhole wichtige Grundlagen für die Prüfung."),
					tasks: [
						germanText("Markiere die wichtigsten Begriffe."),
						germanText("Schreibe kurze Beispiele auf."),
					],
					expectedOutcome: germanText("Du kennst die wichtigsten Grundlagen."),
				},
				{
					phase: "practice",
					title: germanText("Üben"),
					dayOffsetBeforeExam: 2,
					startTime: "15:00",
					durationMinutes: 120,
					goal: germanText("Übe die Aufgaben, die dir noch schwerfallen."),
					tasks: [
						germanText("Löse passende Übungsaufgaben."),
						germanText("Prüfe deine Lösungswege."),
					],
					expectedOutcome: germanText("Du hast zentrale Aufgaben geübt."),
				},
				{
					phase: "rehearsal",
					title: germanText("Generalprobe"),
					dayOffsetBeforeExam: 1,
					startTime: "10:00",
					durationMinutes: 60,
					goal: germanText("Bearbeite eine kurze Generalprobe zur Prüfung."),
					tasks: [
						germanText("Löse einen kompakten Probetest."),
						germanText("Notiere offene Fragen."),
					],
					expectedOutcome: germanText("Du weißt, was du noch wiederholen musst."),
				},
			],
			[
				{ dayOfWeek: 2, startTime: "16:00", endTime: "17:30" },
				{ dayOfWeek: 3, startTime: "15:00", endTime: "17:00" },
				{ dayOfWeek: 4, startTime: "10:00", endTime: "11:00" },
			],
			[
				{
					dayKey: "2026-06-03",
					time: "15:00",
					durationMinutes: 270,
				},
			],
		);

		expect(result.sessions).toHaveLength(6);
		expect(result.sessions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					dateKey: "2026-06-02T00:00:00.000Z",
					startTime: "16:00",
					durationMinutes: 90,
				}),
				expect.objectContaining({
					dateKey: "2026-06-04T00:00:00.000Z",
					startTime: "10:00",
					durationMinutes: 60,
				}),
			]),
		);
		expect(
			result.sessions.filter((session) =>
				session.title.startsWith("Alternative:"),
			),
		).toHaveLength(4);
		expect(result.planningHint).toContain("Lernzeiten belegt");
		expect(result.planningHint).not.toContain("Min. geplant");
	});

	test("fills missing recommended time with alternative slots", () => {
		const result = __testOnlyLearningPlanAi.normalizeSessions(
			"2026-06-05",
			5,
			[
				{
					phase: "practice",
					title: germanText("Adressberechnung üben"),
					dayOffsetBeforeExam: 3,
					startTime: "16:00",
					durationMinutes: 180,
					goal: germanText("Übe Adressberechnung für die Prüfung."),
					tasks: [
						germanText("Berechne Netzwerkadressen."),
						germanText("Prüfe Broadcast-Adressen."),
					],
					expectedOutcome: germanText("Du kannst Adressen sicher berechnen."),
				},
			],
			[{ dayOfWeek: 2, startTime: "16:00", endTime: "17:30" }],
			[],
		);

		expect(result.sessions).toHaveLength(4);
		expect(result.sessions[0]).toMatchObject({
			startTime: "16:00",
			durationMinutes: 90,
		});
		expect(
			result.sessions.filter((session) =>
				session.title.startsWith("Alternative:"),
			),
		).toHaveLength(3);
		expect(result.planningHint).toContain("Alternativen vorgeschlagen");
		expect(result.planningHint).not.toContain("90/180");
	});

	test("creates alternative suggestions when every stored learning slot is busy", () => {
		const result = __testOnlyLearningPlanAi.normalizeSessions(
			"2026-06-05",
			5,
			[
				{
					phase: "practice",
					title: germanText("Subnetting üben"),
					dayOffsetBeforeExam: 2,
					startTime: "15:00",
					durationMinutes: 90,
					goal: germanText("Übe Subnetting-Aufgaben für die Prüfung."),
					tasks: [
						germanText("Berechne passende Subnetze."),
						germanText("Kontrolliere deine Rechenschritte."),
					],
					expectedOutcome: germanText("Du kannst Subnetze sicher berechnen."),
				},
			],
			[{ dayOfWeek: 3, startTime: "15:00", endTime: "17:00" }],
			[
				{
					dayKey: "2026-06-03",
					time: "15:00",
					durationMinutes: 270,
				},
			],
		);

		expect(result.sessions).toHaveLength(3);
		expect(result.sessions[0]).toMatchObject({
			dateKey: "2026-06-03T00:00:00.000Z",
			startTime: "19:30",
			durationMinutes: 30,
		});
		expect(result.sessions[0]?.title).toContain("Alternative:");
		expect(result.planningHint).toContain("Lernzeiten belegt");
		expect(result.planningHint).not.toContain("Min. geplant");
	});
});
