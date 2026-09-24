/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const userIdentity = {
	subject: "user",
	tokenIdentifier: "test:user",
	email: "user@example.com",
};

const otherIdentity = {
	subject: "other",
	tokenIdentifier: "test:other",
	email: "other@example.com",
};

test("deletes the authenticated account data in bounded batches", async () => {
	const backend = convexTest(schema, modules);
	const user = backend.withIdentity(userIdentity);
	const other = backend.withIdentity(otherIdentity);
	const userId = await user.mutation(api.users.syncCurrentUser, {
		name: "Delete Me",
	});
	const otherUserId = await other.mutation(api.users.syncCurrentUser, {
		name: "Keep Me",
	});

	await backend.run(async (ctx) => {
		const questionId = await ctx.db.insert("onboardingQuestions", {
			key: "grade",
			kind: "input",
			order: 0,
			prompt: "Klassenstufe",
		});
		await ctx.db.insert("userOnboardingAnswers", {
			answer: "9",
			questionId,
			userId,
		});
		await ctx.db.insert("userOnboardingAnswers", {
			answer: "10",
			questionId,
			userId: otherUserId,
		});

		for (let index = 0; index < 30; index += 1) {
			await ctx.db.insert("dayEntries", {
				dayKey: `2026-09-${String(index + 1).padStart(2, "0")}`,
				ownerTokenIdentifier: userIdentity.tokenIdentifier,
				title: `Entry ${index + 1}`,
			});
		}
		await ctx.db.insert("dayEntries", {
			dayKey: "2026-10-01",
			ownerTokenIdentifier: otherIdentity.tokenIdentifier,
			title: "Other entry",
		});
		await ctx.db.insert("userLearningTimes", {
			createdAt: 1,
			dayOfWeek: 1,
			endTime: "17:00",
			ownerTokenIdentifier: userIdentity.tokenIdentifier,
			startTime: "16:00",
			updatedAt: 1,
		});
	});

	let done = false;
	let requests = 0;
	while (!done) {
		const result = await user.mutation(
			api.accountDeletion.deleteCurrentUserDataBatch,
			{},
		);
		done = result.done;
		requests += 1;
	}

	expect(requests).toBeGreaterThan(1);
	const remaining = await backend.run(async (ctx) => ({
		dayEntries: await ctx.db.query("dayEntries").take(100),
		onboardingAnswers: await ctx.db.query("userOnboardingAnswers").take(100),
		users: await ctx.db.query("users").take(100),
	}));
	expect(remaining.dayEntries).toMatchObject([
		{ ownerTokenIdentifier: otherIdentity.tokenIdentifier },
	]);
	expect(remaining.onboardingAnswers).toMatchObject([{ userId: otherUserId }]);
	expect(remaining.users).toMatchObject([
		{ tokenIdentifier: otherIdentity.tokenIdentifier },
	]);
});

test("rejects account deletion without an authenticated identity", async () => {
	const backend = convexTest(schema, modules);

	await expect(
		backend.mutation(api.accountDeletion.deleteCurrentUserDataBatch, {}),
	).rejects.toThrow("Nicht authentifiziert");
});
