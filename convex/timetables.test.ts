/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const user = {
	tokenIdentifier: "test:user",
};

test("a reviewed timetable becomes active and appears as dated school lessons", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const timetableId = await t.mutation(api.timetables.createDraft, {});

	await t.mutation(api.timetables.saveAndActivate, {
		timetableId,
		lessons: [
			{
				dayOfWeek: 1,
				subject: "Mathematik",
				startTime: "08:00",
				endTime: "08:45",
				room: "204",
			},
			{
				dayOfWeek: 1,
				subject: "Deutsch",
				startTime: "09:00",
				endTime: "09:45",
			},
		],
	});

	const timetable = await t.query(api.timetables.getMine, {});
	expect(timetable.active).toMatchObject({
		id: timetableId,
		status: "active",
	});
	expect(timetable.active?.lessons).toHaveLength(2);
	expect(timetable.draft).toBeNull();

	const agenda = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-07-27", "2026-07-28"],
	});
	expect(agenda["2026-07-27"]).toEqual([
		expect.objectContaining({
			title: "Mathematik",
			kind: "Unterricht",
			time: "08:00",
			durationMinutes: 45,
			notes: "Raum 204",
		}),
		expect.objectContaining({
			title: "Deutsch",
			kind: "Unterricht",
			time: "09:00",
			durationMinutes: 45,
		}),
	]);
	expect(agenda["2026-07-28"]).toEqual([]);
});

test("draft lessons never appear in the daily agenda", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	await t.mutation(api.timetables.createDraft, {});
	const agenda = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-07-27"],
	});

	expect(agenda["2026-07-27"]).toEqual([]);
});

test("an active school lesson blocks overlapping appointments", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const timetableId = await t.mutation(api.timetables.createDraft, {});
	await t.mutation(api.timetables.saveAndActivate, {
		timetableId,
		lessons: [
			{
				dayOfWeek: 1,
				subject: "Biologie",
				startTime: "10:00",
				endTime: "10:45",
			},
		],
	});

	await expect(
		t.mutation(api.dayEntries.create, {
			dayKey: "2026-07-27",
			title: "Lernsession",
			time: "10:30",
			durationMinutes: 30,
		}),
	).rejects.toThrow('überschneidet sich mit "Biologie"');
});

test("activating a replacement archives the previous timetable", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const firstId = await t.mutation(api.timetables.createDraft, {});
	await t.mutation(api.timetables.saveAndActivate, {
		timetableId: firstId,
		lessons: [
			{
				dayOfWeek: 1,
				subject: "Alt",
				startTime: "08:00",
				endTime: "08:45",
			},
		],
	});
	const secondId = await t.mutation(api.timetables.createDraft, {});
	await t.mutation(api.timetables.saveAndActivate, {
		timetableId: secondId,
		lessons: [
			{
				dayOfWeek: 2,
				subject: "Neu",
				startTime: "08:00",
				endTime: "08:45",
			},
		],
	});

	const timetable = await t.query(api.timetables.getMine, {});
	expect(timetable.active?.id).toBe(secondId);
	expect(timetable.active?.lessons[0]?.subject).toBe("Neu");
});
