/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
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
	schoolType: "Gymnasium",
	grade,
	dailySchoolTime: "60 min",
	studyDays: "Montag, Mittwoch",
	learningTime: "16:00",
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
