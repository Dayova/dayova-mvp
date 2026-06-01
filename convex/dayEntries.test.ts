/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
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
