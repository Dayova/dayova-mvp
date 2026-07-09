/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const user = {
	tokenIdentifier: "test:user",
};

test("allows multiple learning times on the same weekday", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	const firstId = await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 1,
		startTime: "16:00",
		endTime: "17:00",
	});
	const secondId = await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 1,
		startTime: "18:00",
		endTime: "19:00",
	});

	expect(firstId).not.toBe(secondId);
	await expect(t.query(api.learningTimes.listMine, {})).resolves.toEqual([
		{
			id: firstId,
			dayOfWeek: 1,
			startTime: "16:00",
			endTime: "17:00",
		},
		{
			id: secondId,
			dayOfWeek: 1,
			startTime: "18:00",
			endTime: "19:00",
		},
	]);
});

test("updates only the selected learning time", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	const firstId = await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 2,
		startTime: "16:00",
		endTime: "17:00",
	});
	const secondId = await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 2,
		startTime: "18:00",
		endTime: "19:00",
	});

	await t.mutation(api.learningTimes.upsertMine, {
		id: firstId,
		dayOfWeek: 3,
		startTime: "15:30",
		endTime: "16:30",
	});

	await expect(t.query(api.learningTimes.listMine, {})).resolves.toEqual([
		{
			id: secondId,
			dayOfWeek: 2,
			startTime: "18:00",
			endTime: "19:00",
		},
		{
			id: firstId,
			dayOfWeek: 3,
			startTime: "15:30",
			endTime: "16:30",
		},
	]);
});

test("removes only the selected learning time", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	const firstId = await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 4,
		startTime: "16:00",
		endTime: "17:00",
	});
	const secondId = await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 4,
		startTime: "18:00",
		endTime: "19:00",
	});

	await t.mutation(api.learningTimes.removeMine, { id: firstId });

	await expect(t.query(api.learningTimes.listMine, {})).resolves.toEqual([
		{
			id: secondId,
			dayOfWeek: 4,
			startTime: "18:00",
			endTime: "19:00",
		},
	]);
});

test("rejects overlapping learning times on the same weekday", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 5,
		startTime: "16:00",
		endTime: "17:00",
	});

	await expect(
		t.mutation(api.learningTimes.upsertMine, {
			dayOfWeek: 5,
			startTime: "16:30",
			endTime: "17:30",
		}),
	).rejects.toThrow("überschneidet");
});
