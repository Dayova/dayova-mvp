/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
type TestBackend = ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;

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

const onboardingAnswers = (
	overrides: Partial<{
		studyTime: string;
		strength: string;
		challenge: string;
		goal: string;
		state: string;
		schoolType: string;
		grade: string;
		dailySchoolTime: string;
		studyDays: string;
		learningTime: string;
	}> = {},
) => ({
	studyTime: "30 min",
	strength: "Mathe",
	challenge: "Zeitmanagement",
	goal: "Bessere Noten",
	state: "Sachsen",
	schoolType: "Gymnasium",
	grade: "9",
	dailySchoolTime: "45 min",
	studyDays: "Montag, Mittwoch",
	learningTime: "16:30",
	...overrides,
});

const seedLegacyLearningTimeAnswers = async (
	t: TestBackend,
	userId: Id<"users">,
	answers: Partial<
		Record<"studyDays" | "learningTime" | "dailySchoolTime", string>
	>,
) => {
	await t.run(async (ctx) => {
		let order = 0;
		for (const [key, answer] of Object.entries(answers)) {
			const questionId = await ctx.db.insert("onboardingQuestions", {
				key,
				prompt: key,
				kind: "input",
				order,
			});
			await ctx.db.insert("userOnboardingAnswers", {
				userId,
				questionId,
				answer,
			});
			order += 1;
		}
	});
};

test("onboarding persists canonical learning times visible to settings and plans", async () => {
	const backend = convexTest(schema, modules);
	const t = backend.withIdentity(userIdentity);
	const otherT = backend.withIdentity(otherIdentity);
	await t.mutation(api.users.syncCurrentUser, { name: "User" });

	await t.mutation(api.users.saveOnboardingAnswers, {
		answers: onboardingAnswers(),
	});

	const learningTimes = await t.query(api.learningTimes.listMine, {});
	expect(learningTimes).toMatchObject([
		{ dayOfWeek: 1, startTime: "16:30", endTime: "17:15" },
		{ dayOfWeek: 3, startTime: "16:30", endTime: "17:15" },
	]);
	await expect(otherT.query(api.learningTimes.listMine, {})).resolves.toEqual(
		[],
	);

	const examDayEntryId = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-08-01",
		title: "Mathe Klausur",
		time: "09:00",
		kind: "Leistungskontrolle",
		plannedDateLabel: "1. August 2026",
		durationMinutes: 90,
		examTypeLabel: "Klausur",
	});
	const learningPlanId = await t.mutation(api.learningPlans.start, {
		examDayEntryId,
		subject: "Mathe",
		examTypeLabel: "Klausur",
		examDateKey: "2026-08-01",
		examDateLabel: "1. August 2026",
		examTime: "09:00",
		durationMinutes: 90,
		topicDescription: "Lineare Funktionen",
	});
	const context = await t.query(internal.learningPlans.getAiContext, {
		learningPlanId,
	});
	expect(context.learningTimes).toMatchObject([
		{ dayOfWeek: 1, startTime: "16:30", endTime: "17:15" },
		{ dayOfWeek: 3, startTime: "16:30", endTime: "17:15" },
	]);
});

test("onboarding synchronization is idempotent and preserves later settings edits", async () => {
	const t = convexTest(schema, modules).withIdentity(userIdentity);
	await t.mutation(api.users.syncCurrentUser, { name: "User" });

	await t.mutation(api.users.saveOnboardingAnswers, {
		answers: onboardingAnswers(),
	});
	await t.mutation(api.users.saveOnboardingAnswers, {
		answers: onboardingAnswers(),
	});

	const initial = await t.query(api.learningTimes.listMine, {});
	expect(initial).toHaveLength(2);
	const monday = initial.find((entry) => entry.dayOfWeek === 1);
	if (!monday) throw new Error("Expected a Monday learning time.");

	await t.mutation(api.learningTimes.upsertMine, {
		id: monday.id,
		dayOfWeek: 1,
		startTime: "18:00",
		endTime: "19:00",
	});
	await t.mutation(api.users.saveOnboardingAnswers, {
		answers: onboardingAnswers(),
	});

	await expect(t.query(api.learningTimes.listMine, {})).resolves.toMatchObject([
		{ dayOfWeek: 1, startTime: "18:00", endTime: "19:00" },
		{ dayOfWeek: 3, startTime: "16:30", endTime: "17:15" },
	]);
});

test("invalid derived ranges roll back onboarding persistence", async () => {
	const t = convexTest(schema, modules).withIdentity(userIdentity);
	const userId = await t.mutation(api.users.syncCurrentUser, { name: "User" });

	await expect(
		t.mutation(api.users.saveOnboardingAnswers, {
			answers: onboardingAnswers({
				learningTime: "23:30",
				dailySchoolTime: "60 min",
			}),
		}),
	).rejects.toThrow("vor Mitternacht");

	await expect(t.query(api.learningTimes.listMine, {})).resolves.toEqual([]);
	const savedAnswers = await t.run(async (ctx) =>
		ctx.db
			.query("userOnboardingAnswers")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.take(20),
	);
	expect(savedAnswers).toEqual([]);
});

test("returning users are lazily backfilled from complete legacy answers", async () => {
	const t = convexTest(schema, modules).withIdentity(userIdentity);
	const userId = await t.mutation(api.users.syncCurrentUser, { name: "User" });
	await t.run(async (ctx) => {
		for (let index = 0; index < 10; index += 1) {
			const questionId = await ctx.db.insert("onboardingQuestions", {
				key: `legacy-decoy-${index}`,
				prompt: `Legacy question ${index}`,
				kind: "input",
				order: index,
			});
			await ctx.db.insert("userOnboardingAnswers", {
				userId,
				questionId,
				answer: `Legacy answer ${index}`,
			});
		}
	});
	await seedLegacyLearningTimeAnswers(t, userId, {
		studyDays: "Freitag, Sonntag",
		learningTime: "18:00",
		dailySchoolTime: "60 min",
	});

	await t.mutation(api.users.syncCurrentUser, { name: "User" });
	await t.mutation(api.users.syncCurrentUser, { name: "User" });

	await expect(t.query(api.learningTimes.listMine, {})).resolves.toMatchObject([
		{ dayOfWeek: 5, startTime: "18:00", endTime: "19:00" },
		{ dayOfWeek: 7, startTime: "18:00", endTime: "19:00" },
	]);
});

test("legacy recovery leaves manual settings authoritative and skips unsafe answers", async () => {
	const t = convexTest(schema, modules).withIdentity(userIdentity);
	const userId = await t.mutation(api.users.syncCurrentUser, { name: "User" });
	await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 2,
		startTime: "17:00",
		endTime: "18:00",
	});
	await seedLegacyLearningTimeAnswers(t, userId, {
		studyDays: "Montag",
		learningTime: "16:00",
		dailySchoolTime: "60 min",
	});

	await t.mutation(api.users.syncCurrentUser, { name: "User" });
	await expect(t.query(api.learningTimes.listMine, {})).resolves.toMatchObject([
		{ dayOfWeek: 2, startTime: "17:00", endTime: "18:00" },
	]);

	const unsafeT = convexTest(schema, modules).withIdentity(otherIdentity);
	const unsafeUserId = await unsafeT.mutation(api.users.syncCurrentUser, {
		name: "Other",
	});
	await seedLegacyLearningTimeAnswers(unsafeT, unsafeUserId, {
		studyDays: "Montag",
		learningTime: "23:30",
		dailySchoolTime: "60 min",
	});
	await unsafeT.mutation(api.users.syncCurrentUser, { name: "Other" });
	await expect(unsafeT.query(api.learningTimes.listMine, {})).resolves.toEqual(
		[],
	);
});
