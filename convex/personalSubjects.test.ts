/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const user = { tokenIdentifier: "test:subjects:user" };
const otherUser = { tokenIdentifier: "test:subjects:other" };

test("normalizes duplicates and reuses built-in subjects", async () => {
	const backend = convexTest(schema, modules).withIdentity(user);

	await expect(
		backend.mutation(api.personalSubjects.create, { name: "  mathematik  " }),
	).resolves.toEqual({ kind: "builtIn", name: "Mathematik" });

	const first = await backend.mutation(api.personalSubjects.create, {
		name: "  Darstellendes   Spiel ",
	});
	const duplicate = await backend.mutation(api.personalSubjects.create, {
		name: "darstellendes spiel",
	});

	expect(first).toMatchObject({
		kind: "personal",
		name: "Darstellendes Spiel",
	});
	expect(duplicate).toEqual(first);
	expect((await backend.query(api.personalSubjects.list, {})).personal).toEqual(
		[
			{
				id: first.kind === "personal" ? first.id : undefined,
				name: "Darstellendes Spiel",
			},
		],
	);
});

test("keeps personal subjects isolated by account", async () => {
	const backend = convexTest(schema, modules);
	const firstAccount = backend.withIdentity(user);
	const secondAccount = backend.withIdentity(otherUser);

	await firstAccount.mutation(api.personalSubjects.create, {
		name: "Französisch",
	});

	expect(
		(await firstAccount.query(api.personalSubjects.list, {})).personal,
	).toHaveLength(1);
	expect(
		(await secondAccount.query(api.personalSubjects.list, {})).personal,
	).toEqual([]);
	const firstSubject = (await firstAccount.query(api.personalSubjects.list, {}))
		.personal[0];
	if (!firstSubject) throw new Error("Expected personal subject");
	await expect(
		secondAccount.mutation(api.dayEntries.create, {
			dayKey: "2026-10-01",
			title: "Französisch Hausaufgabe",
			subject: "Französisch",
			personalSubjectId: firstSubject.id,
			kind: "Hausaufgabe",
		}),
	).rejects.toThrow("nicht mehr verfügbar");
});

test("only learner-confirmed timetable subjects are reusable", async () => {
	const backend = convexTest(schema, modules).withIdentity(user);
	const timetableId = await backend.mutation(api.timetables.createDraft, {});

	await backend.run(async (ctx) => {
		await ctx.db.insert("timetableLessons", {
			ownerTokenIdentifier: user.tokenIdentifier,
			timetableId,
			dayOfWeek: 1,
			subject: "Theater",
			startTime: "08:00",
			endTime: "08:45",
			sortOrder: 0,
			createdAt: 1,
			updatedAt: 1,
		});
	});
	expect(
		(await backend.query(api.personalSubjects.list, {}))
			.reusableTimetableSubjects,
	).toEqual([]);

	await backend.mutation(api.timetables.saveAndActivate, {
		timetableId,
		lessons: [
			{
				dayOfWeek: 1,
				subject: "Theater",
				startTime: "08:00",
				endTime: "08:45",
			},
			{
				dayOfWeek: 1,
				subject: "Astronomie",
				subjectIsOneTime: true,
				startTime: "09:00",
				endTime: "09:45",
			},
		],
	});
	expect(
		(await backend.query(api.personalSubjects.list, {}))
			.reusableTimetableSubjects,
	).toEqual(["Theater"]);
});

test("renaming updates linked records while deleting preserves their labels", async () => {
	const backend = convexTest(schema, modules).withIdentity(user);
	const created = await backend.mutation(api.personalSubjects.create, {
		name: "Französisch",
	});
	if (created.kind !== "personal") throw new Error("Expected personal subject");

	const examDayEntryId = await backend.mutation(api.dayEntries.create, {
		dayKey: "2026-10-20",
		title: "Französisch Klausur",
		subject: "Französisch",
		personalSubjectId: created.id,
		kind: "Leistungskontrolle",
		examTypeLabel: "Klausur",
		plannedDateLabel: "20. Oktober 2026",
		durationMinutes: 90,
	});
	const homeworkId = await backend.mutation(api.dayEntries.create, {
		dayKey: "2026-10-18",
		title: "Französisch Hausaufgabe",
		subject: "Französisch",
		personalSubjectId: created.id,
		kind: "Hausaufgabe",
		plannedDateLabel: "18. Oktober 2026",
		durationMinutes: 30,
	});
	const learningPlanId = await backend.mutation(api.learningPlans.createDraft, {
		examDayEntryId,
		subject: "Französisch",
		personalSubjectId: created.id,
		examTypeLabel: "Klausur",
		examDateKey: "2026-10-20",
		examDateLabel: "20. Oktober 2026",
		durationMinutes: 90,
		topicDescription: "",
		notes: "",
	});
	const timetableId = await backend.mutation(api.timetables.createDraft, {});
	await backend.mutation(api.timetables.saveAndActivate, {
		timetableId,
		lessons: [
			{
				dayOfWeek: 2,
				subject: "Französisch",
				personalSubjectId: created.id,
				startTime: "09:00",
				endTime: "09:45",
			},
		],
	});

	await backend.mutation(api.personalSubjects.rename, {
		id: created.id,
		name: "Französisch LK",
	});

	const renamed = {
		exam: await backend.query(api.dayEntries.get, { id: examDayEntryId }),
		homework: await backend.query(api.dayEntries.get, { id: homeworkId }),
		plan: (
			await backend.query(api.learningPlans.getSnapshot, { id: learningPlanId })
		)?.plan,
		lessons:
			(await backend.query(api.timetables.getMine, {})).active?.lessons ?? [],
	};

	expect(renamed.exam).toMatchObject({
		subject: "Französisch LK",
		title: "Französisch LK Klausur",
	});
	expect(renamed.homework).toMatchObject({
		subject: "Französisch LK",
		title: "Französisch LK Hausaufgabe",
	});
	expect(renamed.plan?.subject).toBe("Französisch LK");
	expect(renamed.lessons[0]?.subject).toBe("Französisch LK");

	await backend.mutation(api.personalSubjects.remove, { id: created.id });
	const subjectsAfterRemoval = await backend.query(
		api.personalSubjects.list,
		{},
	);
	expect(subjectsAfterRemoval.personal).toEqual([]);
	expect(subjectsAfterRemoval.reusableTimetableSubjects).toEqual([]);
	const retainedExam = await backend.query(api.dayEntries.get, {
		id: examDayEntryId,
	});
	expect(retainedExam).toMatchObject({ subject: "Französisch LK" });
	expect(retainedExam?.personalSubjectId).toBeUndefined();
	const lessonsAfterRemoval = (await backend.query(api.timetables.getMine, {}))
		.active?.lessons;
	expect(lessonsAfterRemoval).toHaveLength(1);
	expect(lessonsAfterRemoval?.[0]).toMatchObject({
		subject: "Französisch LK",
		subjectIsOneTime: true,
		personalSubjectId: null,
	});

	await expect(
		backend.mutation(api.learningPlans.createDraft, {
			examDayEntryId,
			subject: "Französisch LK",
			examTypeLabel: "Klausur",
			examDateKey: "2026-10-20",
			examDateLabel: "20. Oktober 2026",
			durationMinutes: 90,
			topicDescription: "",
			notes: "",
		}),
	).resolves.toEqual(expect.any(String));
});

test("removing a linked plan still allows renaming the retained exam", async () => {
	const backend = convexTest(schema, modules).withIdentity(user);
	const created = await backend.mutation(api.personalSubjects.create, {
		name: "Französisch",
	});
	if (created.kind !== "personal") throw new Error("Expected personal subject");
	const examDayEntryId = await backend.mutation(api.dayEntries.create, {
		dayKey: "2026-10-20",
		title: "Französisch Klausur",
		subject: created.name,
		personalSubjectId: created.id,
		kind: "Leistungskontrolle",
		examTypeLabel: "Klausur",
	});
	const learningPlanId = await backend.mutation(api.learningPlans.createDraft, {
		examDayEntryId,
		subject: created.name,
		personalSubjectId: created.id,
		examTypeLabel: "Klausur",
		examDateKey: "2026-10-20",
		examDateLabel: "20. Oktober 2026",
		durationMinutes: 90,
		topicDescription: "",
		notes: "",
	});

	await backend.mutation(api.learningPlans.removePlan, { id: learningPlanId });
	await backend.mutation(api.personalSubjects.rename, {
		id: created.id,
		name: "Französisch LK",
	});
	expect(
		await backend.query(api.learningPlans.getSnapshot, { id: learningPlanId }),
	).toBeNull();
	expect(
		await backend.query(api.dayEntries.get, { id: examDayEntryId }),
	).toMatchObject({
		subject: "Französisch LK",
		title: "Französisch LK Klausur",
	});
});

test.each([
	"Französisch",
	"Latein",
	"Spanisch",
])("supports %s without a subject allowlist", async (subjectName) => {
	const backend = convexTest(schema, modules).withIdentity(user);
	const created = await backend.mutation(api.personalSubjects.create, {
		name: subjectName,
	});
	if (created.kind !== "personal") throw new Error("Expected personal subject");
	const examDayEntryId = await backend.mutation(api.dayEntries.create, {
		dayKey: "2026-11-20",
		title: `${subjectName} Test`,
		subject: subjectName,
		personalSubjectId: created.id,
		kind: "Leistungskontrolle",
		examTypeLabel: "Test",
		plannedDateLabel: "20. November 2026",
		durationMinutes: 45,
	});
	const planId = await backend.mutation(api.learningPlans.createDraft, {
		examDayEntryId,
		subject: subjectName,
		personalSubjectId: created.id,
		examTypeLabel: "Test",
		examDateKey: "2026-11-20",
		examDateLabel: "20. November 2026",
		durationMinutes: 45,
		topicDescription: "",
		notes: "",
	});

	expect(
		(await backend.query(api.learningPlans.getSnapshot, { id: planId }))?.plan,
	).toMatchObject({
		subject: subjectName,
	});
});

test("legacy timetable labels cannot break personal subject loading", async () => {
	const backend = convexTest(schema, modules).withIdentity(user);
	await backend.mutation(api.personalSubjects.create, { name: "Französisch" });
	await backend.run(async (ctx) => {
		const timetableId = await ctx.db.insert("timetables", {
			ownerTokenIdentifier: user.tokenIdentifier,
			title: "Legacy import",
			status: "active",
			createdAt: 1,
			updatedAt: 1,
		});
		for (const [index, subject] of [
			"",
			"   ",
			"x".repeat(61),
			"  Latein  ",
			"latein",
			"Mathematik",
			"Französisch",
		].entries()) {
			await ctx.db.insert("timetableLessons", {
				ownerTokenIdentifier: user.tokenIdentifier,
				timetableId,
				dayOfWeek: 1,
				subject,
				startTime: "08:00",
				endTime: "08:45",
				sortOrder: index,
				createdAt: 1,
				updatedAt: 1,
			});
		}
	});
	const result = await backend.query(api.personalSubjects.list, {});
	expect(result.personal).toEqual([
		{ id: expect.any(String), name: "Französisch" },
	]);
	expect(result.reusableTimetableSubjects).toEqual(["latein"]);
});

test("invalid new subjects remain rejected and unauthenticated reads stay private", async () => {
	const backend = convexTest(schema, modules);
	await expect(backend.query(api.personalSubjects.list, {})).rejects.toThrow(
		"Nicht authentifiziert",
	);
	const account = backend.withIdentity(user);
	for (const name of ["  ", "x".repeat(61)]) {
		await expect(
			account.mutation(api.personalSubjects.create, { name }),
		).rejects.toThrow();
	}
	expect((await account.query(api.personalSubjects.list, {})).personal).toEqual(
		[],
	);
});
