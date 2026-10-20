/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import { USER_FACING_ERROR_KIND } from "./errors";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const user = {
	tokenIdentifier: "test:user",
};

test.each([
	"Hausaufgabe",
	"Leistungskontrolle",
])("reports creation only for the first save of the same %s", async (kind) => {
	const t = convexTest(schema, modules).withIdentity(user);
	const args = {
		dayKey: "2026-10-24",
		title: `Englisch ${kind}`,
		kind,
		time: "16:00",
		durationMinutes: 30,
	};
	const first = await t.mutation(api.dayEntries.createWithResult, args);
	expect(first.created).toBe(true);
	expect(await t.query(api.dayEntries.get, { id: first.id })).toMatchObject({
		title: args.title,
		kind,
	});
	expect(await t.mutation(api.dayEntries.createWithResult, args)).toEqual({
		id: first.id,
		created: false,
	});
	// Installed clients still receive an ID, and share the same deduplication.
	expect(await t.mutation(api.dayEntries.create, args)).toBe(first.id);
	const entries = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: [args.dayKey],
	});
	expect(entries[args.dayKey]).toHaveLength(1);

	const legacyId = await t.mutation(api.dayEntries.create, {
		...args,
		dayKey: "2026-10-25",
	});
	expect(
		await t.mutation(api.dayEntries.createWithResult, {
			...args,
			dayKey: "2026-10-25",
		}),
	).toEqual({ id: legacyId, created: false });
});

test("creation results require auth and deduplicate within the current owner only", async () => {
	const backend = convexTest(schema, modules);
	const args = {
		dayKey: "2026-10-24",
		title: "Englisch Hausaufgabe",
		kind: "Hausaufgabe",
	};
	await expect(
		backend.mutation(api.dayEntries.createWithResult, args),
	).rejects.toThrow("Nicht authentifiziert.");
	const owner = backend.withIdentity(user);
	const first = await owner.mutation(api.dayEntries.createWithResult, args);
	const other = await backend
		.withIdentity({ tokenIdentifier: "test:another-user" })
		.mutation(api.dayEntries.createWithResult, args);
	expect(other.created).toBe(true);
	expect(other.id).not.toBe(first.id);
	const different = await owner.mutation(api.dayEntries.createWithResult, {
		...args,
		title: "Mathematik Hausaufgabe",
	});
	expect(different.created).toBe(true);
	expect(different.id).not.toBe(first.id);
});

// The cache discriminator changes only the client cache key. A query that
// returns different data, leaks another owner's entries, or skips auth must fail.
test("notification planning reads the same persisted, owner-scoped day entries", async () => {
	const backend = convexTest(schema, modules);
	const t = backend.withIdentity(user);
	const id = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-10-19",
		title: "Mathematik üben",
		kind: "Hausaufgabe",
	});
	await backend
		.withIdentity({ tokenIdentifier: "test:someone-else" })
		.mutation(api.dayEntries.create, {
			dayKey: "2026-10-19",
			title: "Privater Eintrag",
		});
	const args = {
		dayKeys: ["2026-10-19"],
		cacheScope: "notificationPlanning" as const,
	};
	const result = await t.query(api.dayEntries.listByDayKeys, args);
	expect(result["2026-10-19"]).toHaveLength(1);
	expect(result["2026-10-19"]?.[0]).toMatchObject({
		id,
		title: "Mathematik üben",
	});
	expect(result).toEqual(
		await t.query(api.dayEntries.listByDayKeys, { dayKeys: args.dayKeys }),
	);
	await t.mutation(api.dayEntries.setCompleted, { id, completed: true });
	expect(
		(await t.query(api.dayEntries.listByDayKeys, args))["2026-10-19"]?.[0]
			?.completed,
	).toBe(true);
	await expect(
		backend.query(api.dayEntries.listByDayKeys, args),
	).rejects.toThrow();
});

test("revises the same pending exam after navigating back through creation", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const id = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-09-30",
		title: "Biologie Klassenarbeit",
		subject: "Biologie",
		kind: "Leistungskontrolle",
		examTypeLabel: "Klassenarbeit",
		durationMinutes: 30,
	});
	await t.mutation(api.dayEntries.updatePendingExam, {
		id,
		dayKey: "2026-10-01",
		subject: "Chemie",
		personalSubjectId: null,
		subjectIsOneTime: false,
		examTypeLabel: "Test",
		plannedDateLabel: "Donnerstag, 1. Oktober",
		durationMinutes: 45,
	});
	const grouped = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-09-30", "2026-10-01"],
	});
	expect(grouped["2026-09-30"]).toEqual([]);
	const entries = grouped["2026-10-01"];
	expect(entries).toHaveLength(1);
	expect(entries[0]).toMatchObject({
		id,
		dayKey: "2026-10-01",
		subject: "Chemie",
		title: "Chemie Test",
		durationMinutes: 45,
	});
});

test("pending exam edits replace or clear the personal subject reference", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const french = await t.mutation(api.personalSubjects.create, {
		name: "Französisch",
	});
	const latin = await t.mutation(api.personalSubjects.create, {
		name: "Latein",
	});
	if (french.kind !== "personal" || latin.kind !== "personal") {
		throw new Error("Expected personal subjects");
	}
	const id = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-09-30",
		title: "Französisch Klassenarbeit",
		subject: french.name,
		personalSubjectId: french.id,
		kind: "Leistungskontrolle",
		examTypeLabel: "Klassenarbeit",
		durationMinutes: 30,
	});

	await t.mutation(api.dayEntries.updatePendingExam, {
		id,
		dayKey: "2026-10-01",
		subject: latin.name,
		personalSubjectId: latin.id,
		subjectIsOneTime: false,
		examTypeLabel: "Test",
		plannedDateLabel: "1. Oktober",
		durationMinutes: 45,
	});
	expect(await t.query(api.dayEntries.get, { id })).toMatchObject({
		subject: "Latein",
		personalSubjectId: latin.id,
		title: "Latein Test",
	});

	await t.mutation(api.dayEntries.updatePendingExam, {
		id,
		dayKey: "2026-10-02",
		subject: "Chemie",
		personalSubjectId: null,
		subjectIsOneTime: false,
		examTypeLabel: "Klausur",
		plannedDateLabel: "2. Oktober",
		durationMinutes: 60,
	});
	const result = await t.query(api.dayEntries.get, { id });
	expect(result).toMatchObject({ subject: "Chemie", title: "Chemie Klausur" });
	expect(result?.personalSubjectId).toBeUndefined();
	await t.mutation(api.personalSubjects.rename, {
		id: latin.id,
		name: "Sprache",
	});
	expect(await t.query(api.dayEntries.get, { id })).toMatchObject({
		subject: "Chemie",
		title: "Chemie Klausur",
	});
});

test("stores an explicit one-time subject through create and resume", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const id = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-10-03",
		title: "Debattieren Präsentation",
		subject: "Debattieren",
		subjectIsOneTime: true,
		kind: "Leistungskontrolle",
		examTypeLabel: "Präsentation",
		durationMinutes: 20,
	});
	expect(await t.query(api.dayEntries.get, { id })).toMatchObject({
		subject: "Debattieren",
		subjectIsOneTime: true,
	});

	await t.mutation(api.dayEntries.updatePendingExam, {
		id,
		dayKey: "2026-10-04",
		subject: "Rhetorik",
		personalSubjectId: null,
		subjectIsOneTime: true,
		examTypeLabel: "Präsentation",
		plannedDateLabel: "4. Oktober",
		durationMinutes: 25,
	});
	expect(await t.query(api.dayEntries.get, { id })).toMatchObject({
		subject: "Rhetorik",
		subjectIsOneTime: true,
	});
});

test("pending exam edits require ownership and cannot change an exam with a learning plan", async () => {
	const t = convexTest(schema, modules);
	const owner = t.withIdentity(user);
	const id = await owner.mutation(api.dayEntries.create, {
		dayKey: "2026-09-30",
		title: "Biologie Klassenarbeit",
		subject: "Biologie",
		kind: "Leistungskontrolle",
	});
	const edit = {
		id,
		dayKey: "2026-10-01",
		subject: "Chemie",
		personalSubjectId: null,
		subjectIsOneTime: false,
		examTypeLabel: "Test",
		plannedDateLabel: "1. Oktober",
		durationMinutes: 30,
	};
	await expect(
		t
			.withIdentity({ tokenIdentifier: "someone-else" })
			.mutation(api.dayEntries.updatePendingExam, edit),
	).rejects.toThrow("Prüfung nicht gefunden");
	await owner.mutation(api.learningPlans.createDraft, {
		examDayEntryId: id,
		subject: "Biologie",
		examTypeLabel: "Klassenarbeit",
		examDateKey: "2026-09-30",
		examDateLabel: "30. September",
		durationMinutes: 30,
		topicDescription: "Zellteilung und Mitose",
		notes: "",
	});
	await expect(
		owner.mutation(api.dayEntries.updatePendingExam, edit),
	).rejects.toThrow("Lernplan");
	await expect(owner.query(api.dayEntries.get, { id })).resolves.toMatchObject({
		dayKey: "2026-09-30",
		subject: "Biologie",
	});
});

test("keeps adaptive exam entries with a stored subject schema-compatible", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	await expect(
		t.run((ctx) =>
			ctx.db.insert("dayEntries", {
				ownerTokenIdentifier: user.tokenIdentifier,
				dayKey: "2026-08-13",
				title: "Mathematik Klausur",
				subject: "Mathematik",
				topicDescription: "Analysis und Integralrechnung",
				kind: "Leistungskontrolle",
				plannedDateLabel: "Donnerstag, 13. August",
				durationMinutes: 30,
				examTypeLabel: "Klausur",
			}),
		),
	).resolves.toEqual(expect.any(String));
});

test("stores required exam topics without creating a learning plan", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const examDayEntryId = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-08-12",
		title: "Mathematik Klausur",
		subject: "Mathematik",
		kind: "Leistungskontrolle",
		examTypeLabel: "Klausur",
		plannedDateLabel: "12. August 2026",
		durationMinutes: 90,
	});

	await t.mutation(api.dayEntries.updateExamTopics, {
		id: examDayEntryId,
		topicDescription: "Lineare Funktionen, Steigung und Achsenabschnitt",
	});

	await expect(
		t.query(api.dayEntries.get, { id: examDayEntryId }),
	).resolves.toMatchObject({
		topicDescription: "Lineare Funktionen, Steigung und Achsenabschnitt",
	});
	expect(await t.query(api.learningPlans.listOverview, {})).toEqual([]);
});

test("manual timed entry overlapping an existing entry is rejected with conflict details", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-05-23",
		title: "Mathe Hausaufgabe",
		time: "16:00",
		kind: "Hausaufgabe",
		plannedDateLabel: "23. Mai 2026",
		durationMinutes: 30,
	});

	await expect(
		t.mutation(api.dayEntries.create, {
			dayKey: "2026-05-23",
			title: "Deutsch Hausaufgabe",
			time: "16:15",
			kind: "Hausaufgabe",
			plannedDateLabel: "23. Mai 2026",
			durationMinutes: 30,
		}),
	).rejects.toThrow(
		'Dieser Zeitraum überschneidet sich mit "Mathe Hausaufgabe" am 23. Mai 2026 von 16:00 bis 16:30.',
	);
});

test("manual timed entry conflicts are marked as user-facing backend errors", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-05-23",
		title: "Mathe Hausaufgabe",
		time: "16:00",
		kind: "Hausaufgabe",
		plannedDateLabel: "23. Mai 2026",
		durationMinutes: 30,
	});

	const expectedMessage =
		'Dieser Zeitraum überschneidet sich mit "Mathe Hausaufgabe" am 23. Mai 2026 von 16:00 bis 16:30.';
	await expect(
		t.mutation(api.dayEntries.create, {
			dayKey: "2026-05-23",
			title: "Deutsch Hausaufgabe",
			time: "16:15",
			kind: "Hausaufgabe",
			plannedDateLabel: "23. Mai 2026",
			durationMinutes: 30,
		}),
	).rejects.toMatchObject({
		data: {
			kind: USER_FACING_ERROR_KIND,
			message: expectedMessage,
		},
	});
});

test("multiple exams on one day ignore supplied times and are stored untimed", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-07-16",
		title: "Englisch Hausaufgabe",
		time: "16:00",
		kind: "Hausaufgabe",
		plannedDateLabel: "Donnerstag, 16. Juli",
		durationMinutes: 30,
	});

	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-07-16",
		title: "Englisch Klassenarbeit",
		subject: "Englisch",
		time: "16:00",
		kind: "Leistungskontrolle",
		plannedDateLabel: "Donnerstag, 16. Juli",
		durationMinutes: 30,
		examTypeLabel: "Klassenarbeit",
	});
	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-07-16",
		title: "Geschichte Test",
		time: "16:00",
		kind: "Leistungskontrolle",
		plannedDateLabel: "Donnerstag, 16. Juli",
		durationMinutes: 30,
		examTypeLabel: "Test",
	});

	const entries = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-07-16"],
	});
	const exams = entries["2026-07-16"]?.filter(
		(entry) => entry.kind === "Leistungskontrolle",
	);

	expect(exams).toHaveLength(2);
	expect(exams?.every((entry) => entry.time === undefined)).toBe(true);
	expect(
		exams?.find((entry) => entry.title === "Englisch Klassenarbeit"),
	).toMatchObject({
		dayKey: "2026-07-16",
		subject: "Englisch",
	});
});

test("untimed exams with Berlin-midnight ISO day keys do not block homework", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-05-30T22:00:00.000Z",
		title: "Englisch Kurzkontrolle",
		time: "16:00",
		kind: "Leistungskontrolle",
		plannedDateLabel: "31. Mai 2026",
		durationMinutes: 30,
	});

	await expect(
		t.mutation(api.dayEntries.create, {
			dayKey: "2026-05-31",
			title: "Mathe Hausaufgabe",
			time: "16:15",
			kind: "Hausaufgabe",
			plannedDateLabel: "31. Mai 2026",
			durationMinutes: 30,
		}),
	).resolves.toBeTruthy();

	const entries = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-05-31"],
	});
	const exam = entries["2026-05-31"]?.find(
		(entry) => entry.kind === "Leistungskontrolle",
	);
	expect(exam?.time).toBeUndefined();
});

test("manual timed entry adjacent to an existing entry is allowed", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-05-23",
		title: "Mathe Hausaufgabe",
		time: "16:00",
		kind: "Hausaufgabe",
		plannedDateLabel: "23. Mai 2026",
		durationMinutes: 30,
	});

	const createdId = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-05-23",
		title: "Deutsch Hausaufgabe",
		time: "16:30",
		kind: "Hausaufgabe",
		plannedDateLabel: "23. Mai 2026",
		durationMinutes: 30,
	});

	expect(createdId).toBeTruthy();
});

test("homework overview lists only homework entries in schedule order", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	const secondHomeworkId = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-05-24",
		title: "Deutsch Hausaufgabe",
		time: "16:00",
		kind: "Hausaufgabe",
		plannedDateLabel: "24. Mai 2026",
		durationMinutes: 30,
		dueDateKey: "2026-05-25",
		dueDateLabel: "25. Mai 2026",
	});
	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-05-23",
		title: "Mathe Test",
		time: "09:00",
		kind: "Leistungskontrolle",
		plannedDateLabel: "23. Mai 2026",
		durationMinutes: 45,
		examTypeLabel: "Test",
	});
	const firstHomeworkId = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-05-23",
		title: "Mathe Hausaufgabe",
		time: "17:00",
		kind: "Hausaufgabe",
		plannedDateLabel: "23. Mai 2026",
		durationMinutes: 45,
	});

	await expect(
		t.query(api.dayEntries.listHomeworkOverview, {}),
	).resolves.toEqual([
		expect.objectContaining({
			id: firstHomeworkId,
			title: "Mathe Hausaufgabe",
			time: "17:00",
			durationMinutes: 45,
			completed: false,
		}),
		expect.objectContaining({
			id: secondHomeworkId,
			title: "Deutsch Hausaufgabe",
			time: "16:00",
			dueDateLabel: "25. Mai 2026",
			durationMinutes: 30,
			completed: false,
		}),
	]);
});

test("retrying the same create returns the existing entry instead of conflicting with itself", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	const payload = {
		dayKey: "2026-06-15",
		title: "Informatik Mündliche Prüfung",
		time: "12:00",
		kind: "Leistungskontrolle",
		plannedDateLabel: "Montag, 15. Juni",
		durationMinutes: 30,
		examTypeLabel: "Mündliche Prüfung",
	};

	const createdId = await t.mutation(api.dayEntries.create, payload);
	const retriedId = await t.mutation(api.dayEntries.create, payload);

	expect(retriedId).toBe(createdId);

	const entries = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-06-15"],
	});
	expect(entries["2026-06-15"]).toHaveLength(1);
});

test("retrying exam creation remains idempotent after a learning plan links the entry", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const payload = {
		dayKey: "2026-06-28",
		title: "Biologie Klassenarbeit",
		time: "16:00",
		kind: "Leistungskontrolle",
		plannedDateLabel: "Sonntag, 28. Juni",
		durationMinutes: 30,
		examTypeLabel: "Klassenarbeit",
	};

	const examDayEntryId = await t.mutation(api.dayEntries.create, payload);
	await t.mutation(api.learningPlans.createDraft, {
		examDayEntryId,
		subject: "Biologie",
		examTypeLabel: "Klassenarbeit",
		examDateKey: payload.dayKey,
		examDateLabel: payload.plannedDateLabel,
		examTime: payload.time,
		durationMinutes: payload.durationMinutes,
		topicDescription: "",
	});

	await expect(t.mutation(api.dayEntries.create, payload)).resolves.toBe(
		examDayEntryId,
	);
});

test("manual entries can be marked completed and uncompleted", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const entryId = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-16",
		title: "Mathe Hausaufgabe",
		time: "16:00",
		kind: "Hausaufgabe",
		plannedDateLabel: "16. Juni 2026",
		durationMinutes: 45,
	});

	await expect(
		t.mutation(api.dayEntries.setCompleted, {
			id: entryId,
			completed: true,
		}),
	).resolves.toBe(true);

	let entries = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-06-16"],
	});
	expect(entries["2026-06-16"]?.[0]?.completed).toBe(true);

	await expect(
		t.mutation(api.dayEntries.setCompleted, {
			id: entryId,
			completed: false,
		}),
	).resolves.toBe(false);

	entries = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-06-16"],
	});
	expect(entries["2026-06-16"]?.[0]?.completed).toBe(false);
});

test("legacy exam subject metadata remains schema-compatible", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	const entryId = await t.run(async (ctx) =>
		ctx.db.insert("dayEntries", {
			ownerTokenIdentifier: user.tokenIdentifier,
			dayKey: "2026-08-07",
			title: "Englisch Klassenarbeit",
			subject: "Englisch",
			kind: "Leistungskontrolle",
		}),
	);

	await expect(
		t.run(async (ctx) => ctx.db.get("dayEntries", entryId)),
	).resolves.toMatchObject({ subject: "Englisch" });
});
