/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { FEDERAL_STATE_OPTIONS } from "../src/lib/federal-states";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const studentIdentity = {
	subject: "student",
	tokenIdentifier: "test:student",
	email: "student@example.com",
};

const onboardingAnswers = (grade: string) => ({
	studyTime: "30 min",
	strength: "Mathe",
	challenge: "Zeitmanagement",
	goal: "Mehr Struktur im Lernen",
	state: "Bayern",
	schoolType: "gymnasium",
	grade,
	dailySchoolTime: "60 min",
	studyDays: "Montag, Mittwoch",
	learningTime: "16:00",
});

test("bounded school types survive authenticated profile and onboarding writes", async () => {
	const supportedSchoolTypes = [
		"gymnasium",
		"secondary_general",
		"comprehensive",
		"hauptschule",
		"vocational",
		"other",
		"prefer_not_to_say",
	] as const;
	const t = convexTest(schema, modules).withIdentity(studentIdentity);

	const userId = await t.mutation(api.users.syncCurrentUser, {});
	for (const schoolType of supportedSchoolTypes) {
		await expect(
			t.mutation(api.users.updateProfile, { schoolType }),
		).resolves.toEqual({ success: true });
		await expect(t.query(api.users.getMe, {})).resolves.toMatchObject({
			schoolType,
		});
		await expect(
			t.mutation(api.users.saveOnboardingAnswers, {
				answers: { ...onboardingAnswers("9"), schoolType },
			}),
		).resolves.toEqual({ success: true });
	}

	const storedQuestion = await t.run(async (ctx) =>
		ctx.db
			.query("onboardingQuestions")
			.withIndex("by_key", (q) => q.eq("key", "schoolType"))
			.unique(),
	);
	expect(storedQuestion).toMatchObject({
		prompt: "Welche Schulart besuchst du?",
		kind: "select",
		options: supportedSchoolTypes,
	});
	if (!storedQuestion) throw new Error("Missing school type question.");
	await expect(
		t.run(async (ctx) =>
			ctx.db
				.query("userOnboardingAnswers")
				.withIndex("by_userId_and_questionId", (q) =>
					q.eq("userId", userId).eq("questionId", storedQuestion._id),
				)
				.unique(),
		),
	).resolves.toMatchObject({ answer: "prefer_not_to_say" });
});

test("grade 13 survives the authenticated Convex profile round trip", async () => {
	const t = convexTest(schema, modules).withIdentity(studentIdentity);

	const userId = await t.mutation(api.users.syncCurrentUser, { grade: "13" });

	await expect(t.query(api.users.getMe, {})).resolves.toMatchObject({
		grade: "13",
	});
	await expect(
		t.mutation(api.users.saveOnboardingAnswers, {
			answers: onboardingAnswers("13"),
		}),
	).resolves.toEqual({ success: true });
	const savedGrade = await t.run(async (ctx) => {
		const gradeQuestion = await ctx.db
			.query("onboardingQuestions")
			.withIndex("by_key", (q) => q.eq("key", "grade"))
			.unique();
		if (!gradeQuestion) return null;

		return await ctx.db
			.query("userOnboardingAnswers")
			.withIndex("by_userId_and_questionId", (q) =>
				q.eq("userId", userId).eq("questionId", gradeQuestion._id),
			)
			.unique();
	});
	expect(savedGrade).toMatchObject({ answer: "13" });
});

test("bounded federal states stay selectable and survive profile and onboarding writes", async () => {
	const t = convexTest(schema, modules).withIdentity(studentIdentity);

	const userId = await t.mutation(api.users.syncCurrentUser, {
		state: "Mecklenburg-Vorpommern",
	});
	await expect(t.query(api.users.getMe, {})).resolves.toMatchObject({
		state: "Mecklenburg-Vorpommern",
	});

	await expect(
		t.mutation(api.users.saveOnboardingAnswers, {
			answers: {
				...onboardingAnswers("13"),
				state: "Baden-Württemberg",
			},
		}),
	).resolves.toEqual({ success: true });

	const stateQuestion = await t.run(async (ctx) =>
		ctx.db
			.query("onboardingQuestions")
			.withIndex("by_key", (q) => q.eq("key", "state"))
			.unique(),
	);
	expect(stateQuestion).toMatchObject({
		prompt: "Aus welchem Bundesland kommst du?",
		kind: "select",
		options: FEDERAL_STATE_OPTIONS,
	});
	if (!stateQuestion) throw new Error("Missing state question.");
	await expect(
		t.run(async (ctx) =>
			ctx.db
				.query("userOnboardingAnswers")
				.withIndex("by_userId_and_questionId", (q) =>
					q.eq("userId", userId).eq("questionId", stateQuestion._id),
				)
				.unique(),
		),
	).resolves.toMatchObject({ answer: "Baden-Württemberg" });
});

test("profile and onboarding writes reject values outside the federal-state vocabulary", async () => {
	const t = convexTest(schema, modules).withIdentity(studentIdentity);

	await expect(
		t.mutation(api.users.syncCurrentUser, { state: "private state" }),
	).rejects.toThrow("Bundesland");

	await t.mutation(api.users.syncCurrentUser, { state: "Bayern" });
	await expect(
		t.mutation(api.users.updateProfile, { state: "Atlantis" }),
	).rejects.toThrow("Bundesland");
	await expect(
		t.mutation(api.users.saveOnboardingAnswers, {
			answers: { ...onboardingAnswers("9"), state: "Saxony" },
		}),
	).rejects.toThrow("Bundesland");
});

test("profile and onboarding writes reject grades outside the product vocabulary", async () => {
	const t = convexTest(schema, modules).withIdentity(studentIdentity);

	await expect(
		t.mutation(api.users.syncCurrentUser, { grade: "14" }),
	).rejects.toThrow("Klassenstufe");

	await t.mutation(api.users.syncCurrentUser, { grade: "9" });
	await expect(
		t.mutation(api.users.updateProfile, { grade: "5" }),
	).rejects.toThrow("Klassenstufe");
	await expect(
		t.mutation(api.users.saveOnboardingAnswers, {
			answers: onboardingAnswers("14"),
		}),
	).rejects.toThrow("Klassenstufe");
});

test("profile and onboarding writes reject free-text school names", async () => {
	const t = convexTest(schema, modules).withIdentity(studentIdentity);

	await expect(
		t.mutation(api.users.syncCurrentUser, {
			schoolType: "Goethe-Gymnasium Dresden",
		}),
	).rejects.toThrow("Schulart");

	await t.mutation(api.users.syncCurrentUser, { schoolType: "gymnasium" });
	await expect(
		t.mutation(api.users.updateProfile, {
			schoolType: "Realschule am Stadtpark",
		}),
	).rejects.toThrow("Schulart");
	await expect(
		t.mutation(api.users.saveOnboardingAnswers, {
			answers: {
				...onboardingAnswers("9"),
				schoolType: "Goethe-Gymnasium Dresden",
			},
		}),
	).rejects.toThrow("Schulart");
});

test("profile sync maps generic legacy values and clears school names", async () => {
	const t = convexTest(schema, modules).withIdentity(studentIdentity);
	const { userId, schoolTypeQuestionId } = await t.run(async (ctx) => {
		const insertedUserId = await ctx.db.insert("users", {
			tokenIdentifier: studentIdentity.tokenIdentifier,
			clerkId: studentIdentity.subject,
			email: studentIdentity.email,
			schoolType: "Goethe-Gymnasium Dresden",
		});
		const insertedQuestionId = await ctx.db.insert("onboardingQuestions", {
			key: "schoolType",
			prompt: "Welche Schule besuchst du?",
			kind: "input",
			order: 5,
		});
		await ctx.db.insert("userOnboardingAnswers", {
			userId: insertedUserId,
			questionId: insertedQuestionId,
			answer: "Goethe-Gymnasium Dresden",
		});
		return {
			userId: insertedUserId,
			schoolTypeQuestionId: insertedQuestionId,
		};
	});

	await t.mutation(api.users.syncCurrentUser, {});
	expect(await t.query(api.users.getMe, {})).not.toHaveProperty("schoolType");
	await expect(
		t.run(async (ctx) =>
			ctx.db
				.query("userOnboardingAnswers")
				.withIndex("by_userId_and_questionId", (q) =>
					q.eq("userId", userId).eq("questionId", schoolTypeQuestionId),
				)
				.unique(),
		),
	).resolves.toBeNull();

	await t.run(async (ctx) => {
		await ctx.db.patch("users", userId, { schoolType: "Gymnasium" });
		await ctx.db.insert("userOnboardingAnswers", {
			userId,
			questionId: schoolTypeQuestionId,
			answer: "Gymnasium",
		});
	});
	await t.mutation(api.users.syncCurrentUser, {});
	await expect(t.query(api.users.getMe, {})).resolves.toMatchObject({
		schoolType: "gymnasium",
	});
	await expect(
		t.run(async (ctx) =>
			ctx.db
				.query("userOnboardingAnswers")
				.withIndex("by_userId_and_questionId", (q) =>
					q.eq("userId", userId).eq("questionId", schoolTypeQuestionId),
				)
				.unique(),
		),
	).resolves.toMatchObject({ answer: "gymnasium" });
});
