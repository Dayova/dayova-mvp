/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { GERMAN_FEDERAL_STATES } from "../src/lib/federal-states";
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
		state: string;
		schoolType: string;
		grade: string;
		dailySchoolTime: string;
		studyDays: string;
		learningTime: string;
	}> = {},
) => ({
	state: "Sachsen",
	schoolType: "gymnasium",
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

test("release onboarding payload creates operational windows without decorative answers", async () => {
	const t = convexTest(schema, modules).withIdentity(userIdentity);
	const userId = await t.mutation(api.users.syncCurrentUser, { name: "User" });

	await t.mutation(api.users.saveOnboardingAnswers, {
		answers: {
			dailySchoolTime: "30 min",
			studyDays: "Montag, Donnerstag, Samstag",
			learningTime: "16:30",
			state: "Sachsen",
			schoolType: "gymnasium",
			grade: "9",
		},
	});

	await expect(t.query(api.learningTimes.listMine, {})).resolves.toMatchObject([
		{ dayOfWeek: 1, startTime: "16:30", endTime: "17:00" },
		{ dayOfWeek: 4, startTime: "16:30", endTime: "17:00" },
		{ dayOfWeek: 6, startTime: "16:30", endTime: "17:00" },
	]);
	const savedKeys = await t.run(async (ctx) => {
		const answers = await ctx.db
			.query("userOnboardingAnswers")
			.withIndex("by_userId", (query) => query.eq("userId", userId))
			.take(20);
		const keys: string[] = [];
		for (const answer of answers) {
			const question = await ctx.db.get(
				"onboardingQuestions",
				answer.questionId,
			);
			if (question) keys.push(question.key);
		}
		return keys.sort();
	});
	expect(savedKeys).toEqual([
		"dailySchoolTime",
		"grade",
		"learningTime",
		"schoolType",
		"state",
		"studyDays",
	]);
});

test("accepts but never persists legacy decorative answers from installed clients", async () => {
	const t = convexTest(schema, modules).withIdentity(userIdentity);
	const userId = await t.mutation(api.users.syncCurrentUser, { name: "User" });
	const legacyPayload = {
		...onboardingAnswers(),
		studyTime: "30 min",
		strength: "Mathe",
		challenge: "Zeitmanagement",
		goal: "Bessere Noten",
	};

	await t.mutation(api.users.saveOnboardingAnswers, {
		answers: legacyPayload,
	});
	const savedKeys = await t.run(async (ctx) => {
		const answers = await ctx.db
			.query("userOnboardingAnswers")
			.withIndex("by_userId", (query) => query.eq("userId", userId))
			.take(20);
		const keys = await Promise.all(
			answers.map(async (answer) => {
				const question = await ctx.db.get(
					"onboardingQuestions",
					answer.questionId,
				);
				return question?.key;
			}),
		);
		return keys.filter((key): key is string => Boolean(key)).sort();
	});
	expect(savedKeys).toEqual([
		"dailySchoolTime",
		"grade",
		"learningTime",
		"schoolType",
		"state",
		"studyDays",
	]);
});

test("compact onboarding persists profile context without inventing learning times", async () => {
	const t = convexTest(schema, modules).withIdentity(userIdentity);
	const userId = await t.mutation(api.users.syncCurrentUser, { name: "User" });

	await t.mutation(api.users.saveOnboardingAnswers, {
		answers: {
			state: "Sachsen",
			schoolType: "gymnasium",
			grade: "11",
		},
	});

	await expect(t.query(api.learningTimes.listMine, {})).resolves.toEqual([]);
	const savedKeys = await t.run(async (ctx) => {
		const answers = await ctx.db
			.query("userOnboardingAnswers")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.take(20);
		const keys: string[] = [];
		for (const answer of answers) {
			const question = await ctx.db.get(
				"onboardingQuestions",
				answer.questionId,
			);
			if (question) keys.push(question.key);
		}
		return keys.sort();
	});
	expect(savedKeys).toEqual(["grade", "schoolType", "state"]);
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

test("invalid onboarding is rejected when settings already contain learning times", async () => {
	const t = convexTest(schema, modules).withIdentity(userIdentity);
	const userId = await t.mutation(api.users.syncCurrentUser, { name: "User" });
	await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 2,
		startTime: "17:00",
		endTime: "18:00",
	});

	await expect(
		t.mutation(api.users.saveOnboardingAnswers, {
			answers: onboardingAnswers({
				learningTime: "23:30",
				dailySchoolTime: "60 min",
			}),
		}),
	).rejects.toThrow("vor Mitternacht");

	await expect(t.query(api.learningTimes.listMine, {})).resolves.toMatchObject([
		{ dayOfWeek: 2, startTime: "17:00", endTime: "18:00" },
	]);
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

test("legacy recovery treats duplicate historical rows as ambiguous", async () => {
	const duplicateQuestionT = convexTest(schema, modules).withIdentity(
		userIdentity,
	);
	const duplicateQuestionUserId = await duplicateQuestionT.mutation(
		api.users.syncCurrentUser,
		{ name: "User" },
	);
	await seedLegacyLearningTimeAnswers(
		duplicateQuestionT,
		duplicateQuestionUserId,
		{
			studyDays: "Freitag",
			learningTime: "18:00",
			dailySchoolTime: "60 min",
		},
	);
	await duplicateQuestionT.run(async (ctx) => {
		await ctx.db.insert("onboardingQuestions", {
			key: "studyDays",
			prompt: "Ambiguous study days",
			kind: "input",
			order: 99,
		});
	});

	await expect(
		duplicateQuestionT.mutation(api.users.syncCurrentUser, { name: "User" }),
	).resolves.toBe(duplicateQuestionUserId);
	await expect(
		duplicateQuestionT.query(api.learningTimes.listMine, {}),
	).resolves.toEqual([]);
	await duplicateQuestionT.run(async (ctx) => {
		const duplicateQuestion = await ctx.db
			.query("onboardingQuestions")
			.withIndex("by_key", (q) => q.eq("key", "studyDays"))
			.order("desc")
			.first();
		if (!duplicateQuestion) throw new Error("Expected a duplicate question.");
		await ctx.db.delete("onboardingQuestions", duplicateQuestion._id);
	});
	await duplicateQuestionT.mutation(api.users.syncCurrentUser, {
		name: "User",
	});
	await expect(
		duplicateQuestionT.query(api.learningTimes.listMine, {}),
	).resolves.toEqual([]);

	const duplicateAnswerT = convexTest(schema, modules).withIdentity(
		userIdentity,
	);
	const duplicateAnswerUserId = await duplicateAnswerT.mutation(
		api.users.syncCurrentUser,
		{ name: "User" },
	);
	await seedLegacyLearningTimeAnswers(duplicateAnswerT, duplicateAnswerUserId, {
		studyDays: "Freitag",
		learningTime: "18:00",
		dailySchoolTime: "60 min",
	});
	await duplicateAnswerT.run(async (ctx) => {
		const question = await ctx.db
			.query("onboardingQuestions")
			.withIndex("by_key", (q) => q.eq("key", "learningTime"))
			.unique();
		if (!question) throw new Error("Expected a learning-time question.");
		await ctx.db.insert("userOnboardingAnswers", {
			userId: duplicateAnswerUserId,
			questionId: question._id,
			answer: "19:00",
		});
	});

	await expect(
		duplicateAnswerT.mutation(api.users.syncCurrentUser, { name: "User" }),
	).resolves.toBe(duplicateAnswerUserId);
	await expect(
		duplicateAnswerT.query(api.learningTimes.listMine, {}),
	).resolves.toEqual([]);
});

test("legacy recovery never resurrects learning times removed in settings", async () => {
	const t = convexTest(schema, modules).withIdentity(userIdentity);
	const userId = await t.mutation(api.users.syncCurrentUser, { name: "User" });
	await seedLegacyLearningTimeAnswers(t, userId, {
		studyDays: "Freitag",
		learningTime: "18:00",
		dailySchoolTime: "60 min",
	});

	await t.mutation(api.users.syncCurrentUser, { name: "User" });
	const learningTimes = await t.query(api.learningTimes.listMine, {});
	expect(learningTimes).toHaveLength(1);
	await t.mutation(api.learningTimes.removeMine, {
		id: learningTimes[0].id,
	});

	await t.mutation(api.users.syncCurrentUser, { name: "User" });
	await expect(t.query(api.learningTimes.listMine, {})).resolves.toEqual([]);
});

test("completed onboarding never resurrects learning times removed in settings", async () => {
	const t = convexTest(schema, modules).withIdentity(userIdentity);
	await t.mutation(api.users.syncCurrentUser, { name: "User" });
	await t.mutation(api.users.saveOnboardingAnswers, {
		answers: onboardingAnswers(),
	});

	const learningTimes = await t.query(api.learningTimes.listMine, {});
	expect(learningTimes).toHaveLength(2);
	for (const learningTime of learningTimes) {
		await t.mutation(api.learningTimes.removeMine, {
			id: learningTime.id,
		});
	}

	await t.mutation(api.users.syncCurrentUser, { name: "User" });
	await expect(t.query(api.learningTimes.listMine, {})).resolves.toEqual([]);
});

test("future legacy backfill versions are not downgraded or rerun", async () => {
	const t = convexTest(schema, modules).withIdentity(userIdentity);
	const userId = await t.mutation(api.users.syncCurrentUser, { name: "User" });
	await t.run(async (ctx) => {
		await ctx.db.patch("users", userId, {
			learningTimesBackfillVersion: 2,
		});
	});
	await t.mutation(api.users.saveOnboardingAnswers, {
		answers: onboardingAnswers(),
	});

	const learningTimes = await t.query(api.learningTimes.listMine, {});
	for (const learningTime of learningTimes) {
		await t.mutation(api.learningTimes.removeMine, {
			id: learningTime.id,
		});
	}
	await t.mutation(api.users.syncCurrentUser, { name: "User" });
	await expect(t.query(api.learningTimes.listMine, {})).resolves.toEqual([]);
	await t.run(async (ctx) => {
		const user = await ctx.db.get("users", userId);
		expect(user?.learningTimesBackfillVersion).toBe(2);
	});
});

test("settings changes close an incomplete legacy recovery window", async () => {
	const t = convexTest(schema, modules).withIdentity(userIdentity);
	const userId = await t.mutation(api.users.syncCurrentUser, { name: "User" });
	await seedLegacyLearningTimeAnswers(t, userId, {
		studyDays: "Freitag",
		learningTime: "18:00",
	});

	const learningTimeId = await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 2,
		startTime: "17:00",
		endTime: "18:00",
	});
	await t.mutation(api.learningTimes.removeMine, { id: learningTimeId });
	await seedLegacyLearningTimeAnswers(t, userId, {
		dailySchoolTime: "60 min",
	});

	await t.mutation(api.users.syncCurrentUser, { name: "User" });
	await expect(t.query(api.learningTimes.listMine, {})).resolves.toEqual([]);
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
	const t = convexTest(schema, modules).withIdentity(userIdentity);

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
				answers: { ...onboardingAnswers({ grade: "9" }), schoolType },
			}),
		).resolves.toMatchObject({ success: true });
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
	const t = convexTest(schema, modules).withIdentity(userIdentity);

	const userId = await t.mutation(api.users.syncCurrentUser, { grade: "13" });

	await expect(t.query(api.users.getMe, {})).resolves.toMatchObject({
		grade: "13",
	});
	await expect(
		t.mutation(api.users.saveOnboardingAnswers, {
			answers: onboardingAnswers({ grade: "13" }),
		}),
	).resolves.toMatchObject({ success: true });
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
	const t = convexTest(schema, modules).withIdentity(userIdentity);

	const userId = await t.mutation(api.users.syncCurrentUser, {
		state: "Mecklenburg-Vorpommern",
	});
	await expect(t.query(api.users.getMe, {})).resolves.toMatchObject({
		state: "Mecklenburg-Vorpommern",
	});

	await expect(
		t.mutation(api.users.saveOnboardingAnswers, {
			answers: {
				...onboardingAnswers({ grade: "13" }),
				state: "Baden-Württemberg",
			},
		}),
	).resolves.toMatchObject({ success: true });

	const stateQuestion = await t.run(async (ctx) =>
		ctx.db
			.query("onboardingQuestions")
			.withIndex("by_key", (q) => q.eq("key", "state"))
			.unique(),
	);
	expect(stateQuestion).toMatchObject({
		prompt: "Aus welchem Bundesland kommst du?",
		kind: "select",
		options: GERMAN_FEDERAL_STATES,
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
	const t = convexTest(schema, modules).withIdentity(userIdentity);

	await expect(
		t.mutation(api.users.syncCurrentUser, { state: "private state" }),
	).rejects.toThrow("Bundesland");

	await t.mutation(api.users.syncCurrentUser, { state: "Bayern" });
	await expect(
		t.mutation(api.users.updateProfile, { state: "Atlantis" }),
	).rejects.toThrow("Bundesland");
	await expect(
		t.mutation(api.users.saveOnboardingAnswers, {
			answers: { ...onboardingAnswers({ grade: "9" }), state: "Saxony" },
		}),
	).rejects.toThrow("Bundesland");
});

test("profile and onboarding writes reject grades outside the product vocabulary", async () => {
	const t = convexTest(schema, modules).withIdentity(userIdentity);

	await expect(
		t.mutation(api.users.syncCurrentUser, { grade: "14" }),
	).rejects.toThrow("Klassenstufe");

	await t.mutation(api.users.syncCurrentUser, { grade: "9" });
	await expect(
		t.mutation(api.users.updateProfile, { grade: "5" }),
	).rejects.toThrow("Klassenstufe");
	await expect(
		t.mutation(api.users.saveOnboardingAnswers, {
			answers: onboardingAnswers({ grade: "14" }),
		}),
	).rejects.toThrow("Klassenstufe");
});

test("profile and onboarding writes reject free-text school names", async () => {
	const t = convexTest(schema, modules).withIdentity(userIdentity);

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
				...onboardingAnswers({ grade: "9" }),
				schoolType: "Goethe-Gymnasium Dresden",
			},
		}),
	).rejects.toThrow("Schulart");
});

test("profile sync maps generic legacy values and clears school names", async () => {
	const t = convexTest(schema, modules).withIdentity(userIdentity);
	const { userId, schoolTypeQuestionId } = await t.run(async (ctx) => {
		const insertedUserId = await ctx.db.insert("users", {
			tokenIdentifier: userIdentity.tokenIdentifier,
			clerkId: userIdentity.subject,
			email: userIdentity.email,
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
