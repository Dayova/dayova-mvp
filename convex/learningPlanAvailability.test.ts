/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const user = { tokenIdentifier: "test:user" };
const availabilityArgs = {
	fromDateKey: "2026-06-01",
	fromTimeMinutes: 0,
	examDateKey: "2026-06-03",
};

test("reports saved learning time as occupied after an appointment fills it", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 2,
		startTime: "17:00",
		endTime: "18:00",
	});

	await expect(
		t.query(api.learningPlans.getSchedulingAvailability, availabilityArgs),
	).resolves.toEqual({
		availableStudyMinutes: 60,
		status: "available",
	});

	await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-02",
		title: "Englisch lernen",
		time: "17:00",
		durationMinutes: 60,
	});

	await expect(
		t.query(api.learningPlans.getSchedulingAvailability, availabilityArgs),
	).resolves.toEqual({
		availableStudyMinutes: 0,
		status: "occupied",
	});
});

test("subtracts active timetable lessons from learning-plan availability", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 2,
		startTime: "08:00",
		endTime: "09:00",
	});
	const timetableId = await t.mutation(api.timetables.createDraft, {});
	await t.mutation(api.timetables.saveAndActivate, {
		timetableId,
		lessons: [
			{
				dayOfWeek: 2,
				subject: "Mathematik",
				startTime: "08:00",
				endTime: "09:00",
			},
		],
	});

	await expect(
		t.query(api.learningPlans.getSchedulingAvailability, availabilityArgs),
	).resolves.toEqual({
		availableStudyMinutes: 0,
		status: "occupied",
	});
});

test("does not report a learning window that has already started today", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 2,
		startTime: "17:00",
		endTime: "18:00",
	});

	await expect(
		t.query(api.learningPlans.getSchedulingAvailability, {
			fromDateKey: "2026-06-02",
			fromTimeMinutes: 17 * 60,
			examDateKey: "2026-06-03",
		}),
	).resolves.toEqual({
		availableStudyMinutes: 0,
		status: "missing",
	});
});
