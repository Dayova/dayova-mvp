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

test("manual timed entry conflicts with Berlin-midnight ISO day keys", async () => {
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
	).rejects.toThrow(
		'Dieser Zeitraum überschneidet sich mit "Englisch Kurzkontrolle" am 31. Mai 2026 von 16:00 bis 16:30.',
	);
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
