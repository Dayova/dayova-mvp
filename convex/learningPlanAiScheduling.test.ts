import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { __testOnlyLearningPlanAi } from "./learningPlanAi";
import { MISSING_LEARNING_TIMES_HINT } from "./learningPlanPlanningHints";

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
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-01T08:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test("can schedule the same generated recommendation after learning times are added", () => {
		const recommendation = [
			{
				phase: "practice" as const,
				title: germanText("Aufgaben üben"),
				dayOffsetBeforeExam: 1,
				startTime: "17:00",
				durationMinutes: 60,
				goal: germanText("Übe typische Aufgaben für die Prüfung."),
				tasks: [
					germanText("Löse drei passende Aufgaben."),
					germanText("Kontrolliere deine Lösungswege."),
				],
				expectedOutcome: germanText("Du kannst die Aufgaben sicher lösen."),
			},
		];

		const withoutLearningTimes = __testOnlyLearningPlanAi.normalizeSessions(
			"2026-06-05",
			5,
			recommendation,
			[],
			[],
		);
		expect(withoutLearningTimes.sessions).toHaveLength(0);
		expect(withoutLearningTimes.planningHint).toBe(
			`${MISSING_LEARNING_TIMES_HINT} 0/60 Min. geplant.`,
		);

		const withLearningTimes = __testOnlyLearningPlanAi.normalizeSessions(
			"2026-06-05",
			5,
			recommendation,
			[{ dayOfWeek: 4, startTime: "17:00", endTime: "18:00" }],
			[],
		);

		expect(withLearningTimes.sessions).toHaveLength(1);
		expect(withLearningTimes.sessions[0]).toMatchObject({
			dateKey: "2026-06-04T00:00:00.000Z",
			startTime: "17:00",
			durationMinutes: 30,
		});
		expect(withLearningTimes.planningHint).toBe("30/60 Min. geplant.");
	});

	test("uses only the requested workload from a longer learning time", () => {
		const result = __testOnlyLearningPlanAi.normalizeSessions(
			"2026-06-05",
			5,
			[
				{
					phase: "theory",
					title: germanText("Grundlagen"),
					dayOffsetBeforeExam: 3,
					startTime: "16:00",
					durationMinutes: 30,
					goal: germanText("Wiederhole die wichtigsten Grundlagen."),
					tasks: [
						germanText("Erkläre die zentralen Begriffe."),
						germanText("Prüfe dein Verständnis an einem Beispiel."),
					],
					expectedOutcome: germanText(
						"Du kannst die wichtigsten Grundlagen erklären.",
					),
				},
			],
			[{ dayOfWeek: 2, startTime: "16:00", endTime: "17:30" }],
			[],
		);

		expect(result.sessions).toHaveLength(1);
		expect(result.sessions[0]).toMatchObject({
			startTime: "16:00",
			durationMinutes: 30,
		});
		expect(result.planningHint).toBeUndefined();
	});

	test("splits total plan workload across saved learning times", () => {
		const result = __testOnlyLearningPlanAi.normalizeSessions(
			"2026-06-05",
			5,
			[
				{
					phase: "theory",
					title: germanText("Grundlagen"),
					dayOffsetBeforeExam: 3,
					startTime: "16:00",
					durationMinutes: 20,
					goal: germanText("Wiederhole die wichtigsten Grundlagen."),
					tasks: [
						germanText("Erkläre die zentralen Begriffe."),
						germanText("Prüfe dein Verständnis an einem Beispiel."),
					],
					expectedOutcome: germanText("Du kannst die Grundlagen erklären."),
				},
				{
					phase: "practice",
					title: germanText("Aufgaben üben"),
					dayOffsetBeforeExam: 2,
					startTime: "17:00",
					durationMinutes: 30,
					goal: germanText("Wende die Grundlagen sicher an."),
					tasks: [
						germanText("Löse eine passende Aufgabe."),
						germanText("Kontrolliere deinen Lösungsweg."),
					],
					expectedOutcome: germanText("Du kannst die Aufgabe sicher lösen."),
				},
			],
			[
				{ dayOfWeek: 1, startTime: "16:00", endTime: "17:00" },
				{ dayOfWeek: 2, startTime: "16:00", endTime: "17:00" },
			],
			[],
		);

		expect(result.sessions.map((session) => session.durationMinutes)).toEqual([
			30, 20,
		]);
		expect(result.sessions.map((session) => session.startTime)).toEqual([
			"16:00",
			"16:00",
		]);
		expect(result.planningHint).toBeUndefined();
	});

	test("uses the confirmed total plan workload instead of AI duration guesses", () => {
		const result = __testOnlyLearningPlanAi.normalizeSessions(
			"2026-06-05",
			5,
			[
				{
					phase: "theory",
					title: germanText("Grundlagen"),
					dayOffsetBeforeExam: 3,
					startTime: "16:00",
					durationMinutes: 45,
					goal: germanText("Wiederhole die wichtigsten Grundlagen."),
					tasks: [
						germanText("Erkläre die zentralen Begriffe."),
						germanText("Prüfe dein Verständnis an einem Beispiel."),
					],
					expectedOutcome: germanText("Du kannst die Grundlagen erklären."),
				},
				{
					phase: "practice",
					title: germanText("Aufgaben üben"),
					dayOffsetBeforeExam: 2,
					startTime: "16:00",
					durationMinutes: 45,
					goal: germanText("Wende die Grundlagen sicher an."),
					tasks: [
						germanText("Löse eine passende Aufgabe."),
						germanText("Kontrolliere deinen Lösungsweg."),
					],
					expectedOutcome: germanText("Du kannst die Aufgabe sicher lösen."),
				},
			],
			[
				{ dayOfWeek: 1, startTime: "16:00", endTime: "17:00" },
				{ dayOfWeek: 2, startTime: "16:00", endTime: "17:00" },
			],
			[],
			50,
		);

		expect(result.sessions.map((session) => session.durationMinutes)).toEqual([
			30, 20,
		]);
		expect(result.planningHint).toBeUndefined();
	});

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
					expectedOutcome: germanText(
						"Du weißt, was du noch wiederholen musst.",
					),
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

		expect(result.sessions).toHaveLength(2);
		expect(result.sessions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					dateKey: "2026-06-02T00:00:00.000Z",
					startTime: "16:00",
					durationMinutes: 30,
				}),
				expect.objectContaining({
					dateKey: "2026-06-04T00:00:00.000Z",
					startTime: "10:00",
					durationMinutes: 30,
				}),
			]),
		);
		expect(result.planningHint).toBe(
			"Belegte Zeiten ausgelassen. 60/270 Min. geplant.",
		);
	});

	test("reports capacity instead of inventing alternative slots", () => {
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

		expect(result.sessions).toHaveLength(1);
		expect(result.sessions[0]).toMatchObject({
			startTime: "16:00",
			durationMinutes: 30,
		});
		expect(result.planningHint).toBe("30/180 Min. geplant.");
	});

	test("does not schedule outside Lernzeiten when every stored slot is busy", () => {
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

		expect(result.sessions).toHaveLength(0);
		expect(result.planningHint).toBe(
			"Belegte Zeiten ausgelassen. 0/90 Min. geplant.",
		);
	});

	test("keeps the generated phase progression when learning times create extra slots", () => {
		const result = __testOnlyLearningPlanAi.normalizeSessions(
			"2026-06-05",
			5,
			[
				{
					phase: "theory",
					title: germanText("Grundlagen"),
					dayOffsetBeforeExam: 4,
					startTime: "17:00",
					durationMinutes: 60,
					goal: germanText("Wiederhole die wichtigsten Grundlagen."),
					tasks: [
						germanText("Markiere zentrale Begriffe."),
						germanText("Schreibe kurze Beispiele auf."),
					],
					expectedOutcome: germanText("Du kennst die Grundlagen."),
				},
				{
					phase: "practice",
					title: germanText("Aufgaben üben"),
					dayOffsetBeforeExam: 2,
					startTime: "17:00",
					durationMinutes: 120,
					goal: germanText("Übe typische Prüfungsaufgaben."),
					tasks: [
						germanText("Löse passende Übungsaufgaben."),
						germanText("Prüfe deine Lösungswege."),
					],
					expectedOutcome: germanText("Du kannst Aufgaben sicher lösen."),
				},
				{
					phase: "rehearsal",
					title: germanText("Generalprobe"),
					dayOffsetBeforeExam: 1,
					startTime: "17:00",
					durationMinutes: 60,
					goal: germanText("Bearbeite einen kurzen Probetest."),
					tasks: [
						germanText("Löse den Probetest am Stück."),
						germanText("Notiere offene Fragen."),
					],
					expectedOutcome: germanText("Du weißt, was noch fehlt."),
				},
			],
			[
				{ dayOfWeek: 1, startTime: "17:00", endTime: "18:00" },
				{ dayOfWeek: 2, startTime: "17:00", endTime: "18:00" },
				{ dayOfWeek: 3, startTime: "17:00", endTime: "18:00" },
				{ dayOfWeek: 4, startTime: "17:00", endTime: "18:00" },
			],
			[],
		);

		expect(result.sessions.map((session) => session.phase)).toEqual([
			"theory",
			"practice",
			"practice",
			"rehearsal",
		]);
		expect(result.planningHint).toBe("120/240 Min. geplant.");
	});

	test("does not expand one long theory recommendation into only theory sessions", () => {
		const result = __testOnlyLearningPlanAi.normalizeSessions(
			"2026-06-05",
			5,
			[
				{
					phase: "theory",
					title: germanText("SQL-Grundlagen"),
					dayOffsetBeforeExam: 4,
					startTime: "17:00",
					durationMinutes: 120,
					goal: germanText("Wiederhole SQL-Grundlagen vor der Prüfung."),
					tasks: [
						germanText("Lies die wichtigsten SQL-Regeln."),
						germanText("Schreibe kurze Beispiele auf."),
					],
					expectedOutcome: germanText("Du kennst zentrale SQL-Grundlagen."),
				},
			],
			[
				{ dayOfWeek: 1, startTime: "17:00", endTime: "17:30" },
				{ dayOfWeek: 2, startTime: "17:00", endTime: "17:30" },
				{ dayOfWeek: 3, startTime: "17:00", endTime: "17:30" },
				{ dayOfWeek: 4, startTime: "17:00", endTime: "17:30" },
			],
			[],
		);

		expect(result.sessions.map((session) => session.phase)).toEqual([
			"theory",
			"practice",
			"practice",
			"rehearsal",
		]);
		expect(result.sessions[1]?.title).toBe("Übungsblock");
		expect(result.sessions[3]?.title).toBe("Praxis");
		expect(result.planningHint).toBeUndefined();
	});

	test("does not schedule generated sessions in past dates or times", () => {
		vi.setSystemTime(new Date("2026-06-04T13:30:00.000Z"));

		const result = __testOnlyLearningPlanAi.normalizeSessions(
			"2026-06-06",
			3,
			[
				{
					phase: "practice",
					title: germanText("Aufgaben üben"),
					dayOffsetBeforeExam: 1,
					startTime: "17:00",
					durationMinutes: 60,
					goal: germanText("Übe typische Prüfungsaufgaben."),
					tasks: [
						germanText("Löse passende Übungsaufgaben."),
						germanText("Prüfe deine Lösungswege."),
					],
					expectedOutcome: germanText("Du kannst Aufgaben sicher lösen."),
				},
			],
			[
				{ dayOfWeek: 3, startTime: "17:00", endTime: "18:00" },
				{ dayOfWeek: 4, startTime: "10:00", endTime: "11:00" },
				{ dayOfWeek: 5, startTime: "09:00", endTime: "10:00" },
			],
			[],
		);

		expect(result.sessions).toHaveLength(1);
		expect(result.sessions[0]).toMatchObject({
			dateKey: "2026-06-05T00:00:00.000Z",
			startTime: "09:00",
		});
	});

	test("does not move a past Lernzeit to an invented time", () => {
		vi.setSystemTime(new Date("2026-06-04T13:30:00.000Z"));

		const result = __testOnlyLearningPlanAi.normalizeSessions(
			"2026-06-05",
			1,
			[
				{
					phase: "practice",
					title: germanText("Kurz üben"),
					dayOffsetBeforeExam: 1,
					startTime: "10:00",
					durationMinutes: 30,
					goal: germanText("Übe eine kurze Aufgabe für die Prüfung."),
					tasks: [
						germanText("Löse eine passende Aufgabe."),
						germanText("Prüfe deine Lösung."),
					],
					expectedOutcome: germanText("Du hast eine Aufgabe sicher gelöst."),
				},
			],
			[{ dayOfWeek: 4, startTime: "10:00", endTime: "11:00" }],
			[],
		);

		expect(result.sessions).toHaveLength(0);
		expect(result.planningHint).toBe("0/30 Min. geplant.");
	});
});
