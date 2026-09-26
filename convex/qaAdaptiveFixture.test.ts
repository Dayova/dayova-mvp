/// <reference types="vite/client" />
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { deriveBehavioralLearningTimeSuggestion } from "./learningTimeBehavior";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
test("replays only QA observations after undo without changing sessions", async () => {
	const { t, userId } = await setup();
	const planId = await t.mutation(create, { userId });
	const read = () =>
		t.run((ctx) =>
			ctx.db
				.query("learningPlanSessions")
				.withIndex("by_learningPlanId_and_sortOrder", (q) =>
					q.eq("learningPlanId", planId),
				)
				.take(20),
		);
	const before = await read();
	await t.run((ctx) =>
		ctx.db.patch("users", userId, {
			behavioralLearningTimeObservationStartedAt: Date.now(),
			behavioralLearningTimeSuggestionDismissedFingerprint:
				"1:17:00-18:00|2:17:00-18:00|5:19:10-00:00=>1:18:00-19:00",
		}),
	);
	const replay = makeFunctionReference<"mutation">(
		"qaAdaptiveFixture:replayObservation",
	);
	await t.mutation(replay, { userId });
	await t.mutation(replay, { userId });
	expect(
		(await t.run((ctx) => ctx.db.get("users", userId)))
			?.behavioralLearningTimeObservationStartedAt,
	).toBeUndefined();
	expect(await read()).toEqual(before);
	await t.run((ctx) =>
		ctx.db.patch("users", userId, {
			behavioralLearningTimeSuggestionDismissedFingerprint: "unrelated",
		}),
	);
	await expect(t.mutation(replay, { userId })).rejects.toThrow("Expected QA");
	vi.stubEnv("CONVEX_CLOUD_URL", "https://production.convex.cloud");
	await expect(t.mutation(replay, { userId })).rejects.toThrow("QA deployment");
});
const create = makeFunctionReference<"mutation">("qaAdaptiveFixture:create");
const setExam = makeFunctionReference<"mutation">(
	"qaAdaptiveFixture:setGradeElevenExamCase",
);
beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-09-25T12:00:00Z"));
	vi.stubEnv("CONVEX_CLOUD_URL", "https://trustworthy-skunk-257.convex.cloud");
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

async function setup(name = "Philipp QA Elf") {
	const t = convexTest(schema, modules);
	const userId = await t.run((ctx) =>
		ctx.db.insert("users", {
			tokenIdentifier: "qa:fixture",
			clerkId: "fixture",
			email: "fixture@example.invalid",
			name,
			grade: "11",
		}),
	);
	return { t, userId };
}

test("creates seven sessions once and proposes only Monday", async () => {
	const { t, userId } = await setup();
	const planId = await t.mutation(create, { userId });
	expect(await t.mutation(create, { userId })).toBe(planId);
	const snapshot = await t.run(async (ctx) => ({
		sessions: await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", planId),
			)
			.take(20),
		times: await ctx.db
			.query("userLearningTimes")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", "qa:fixture"),
			)
			.take(20),
	}));
	expect(snapshot.sessions).toHaveLength(7);
	expect(snapshot.times).toHaveLength(2);
	expect(
		deriveBehavioralLearningTimeSuggestion({
			sessions: snapshot.sessions,
			learningTimes: snapshot.times,
			grade: "11",
			referenceTime: Date.now(),
		})?.entries,
	).toEqual([
		expect.objectContaining({
			dayOfWeek: 1,
			startTime: "18:00",
			endTime: "19:00",
		}),
	]);
});

test("rejects any other deployment", async () => {
	const { t, userId } = await setup();
	vi.stubEnv("CONVEX_CLOUD_URL", "https://production.convex.cloud");
	await expect(t.mutation(create, { userId })).rejects.toThrow(
		"designated QA deployment",
	);
});

test("Monday proposal preserves the valid Tuesday session", async () => {
	const { t, userId } = await setup();
	await t.mutation(create, { userId });
	await t.run((ctx) =>
		ctx.db.insert("userLearningTimes", {
			ownerTokenIdentifier: "qa:fixture",
			dayOfWeek: 5,
			startTime: "19:10",
			endTime: "00:00",
			preferenceStatus: "systemDefault",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		}),
	);
	const client = t.withIdentity({ tokenIdentifier: "qa:fixture" });
	const routine = await client.query(api.learningTimes.getHomeRoutine, {
		referenceTime: Date.now(),
	});
	if (!routine?.behavioral) throw new Error("Missing proposal");
	const impact = await client.query(
		api.learningTimes.previewBehavioralSuggestion,
		{
			fingerprint: routine.behavioral.fingerprint,
			referenceTime: Date.now(),
		},
	);
	expect(impact?.conflicts).toEqual([]);
	expect(impact?.changes).toHaveLength(1);
	if (!impact) throw new Error("Missing impact");
	const sessions = () =>
		t.run((ctx) =>
			ctx.db
				.query("learningPlanSessions")
				.withIndex("by_ownerTokenIdentifier", (q) =>
					q.eq("ownerTokenIdentifier", "qa:fixture"),
				)
				.take(20),
		);
	const before = await sessions();
	await client.mutation(api.learningTimes.applyBehavioralSuggestion, {
		fingerprint: routine.behavioral.fingerprint,
		expectedImpactRevision: impact.revision,
	});
	const applied = await sessions();
	expect(applied.find((s) => s.sortOrder === 5)).toMatchObject({
		dateKey: "2026-09-28",
		startTime: "18:00",
	});
	expect(applied.filter((s) => s.completed)).toEqual(
		before.filter((s) => s.completed),
	);
	await client.mutation(api.learningTimes.undoBehavioralSuggestion, {});
	const restored = await sessions();
	expect(restored.filter((s) => s.completed)).toEqual(
		before.filter((s) => s.completed),
	);
	expect(restored.map((s) => [s.dateKey, s.startTime])).toEqual(
		before.map((s) => [s.dateKey, s.startTime]),
	);
});
test("rejects non-QA accounts", async () => {
	const { t, userId } = await setup("Real student");
	await expect(t.mutation(create, { userId })).rejects.toThrow("QA account");
});
test("preserves existing Monday times instead of replacing them", async () => {
	const { t, userId } = await setup();
	const id = await t.run((ctx) =>
		ctx.db.insert("userLearningTimes", {
			ownerTokenIdentifier: "qa:fixture",
			dayOfWeek: 1,
			startTime: "16:00",
			endTime: "22:00",
			createdAt: 1,
			updatedAt: 1,
		}),
	);
	await expect(t.mutation(create, { userId })).rejects.toThrow(
		"existing times are preserved",
	);
	expect(
		await t.run((ctx) => ctx.db.get("userLearningTimes", id)),
	).toMatchObject({ startTime: "16:00", endTime: "22:00" });
});
test("rejects expired fixture dates", async () => {
	const { t, userId } = await setup();
	vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
	await expect(t.mutation(create, { userId })).rejects.toThrow("expired");
});

test("switches only the QA exam deadline without changing sessions", async () => {
	const { t, userId } = await setup();
	const planId = await t.mutation(create, { userId });
	await t.run((ctx) =>
		ctx.db.patch("learningPlans", planId, {
			subject: "Mathematik",
			examDateKey: "2026-09-25",
		}),
	);
	const sessions = () =>
		t.run((ctx) =>
			ctx.db
				.query("learningPlanSessions")
				.withIndex("by_learningPlanId_and_sortOrder", (q) =>
					q.eq("learningPlanId", planId),
				)
				.take(20),
		);
	const before = await sessions();
	await t.mutation(setExam, { planId, future: true });
	await t.mutation(setExam, { planId, future: true });
	expect(
		(await t.run((ctx) => ctx.db.get("learningPlans", planId)))?.examDateKey,
	).toBe("2026-10-05");
	await t.mutation(setExam, { planId, future: false });
	expect(
		(await t.run((ctx) => ctx.db.get("learningPlans", planId)))?.examDateKey,
	).toBe("2026-09-25");
	expect(await sessions()).toEqual(before);
	vi.stubEnv("CONVEX_CLOUD_URL", "https://production.convex.cloud");
	await expect(t.mutation(setExam, { planId, future: true })).rejects.toThrow(
		"QA deployment",
	);
});
