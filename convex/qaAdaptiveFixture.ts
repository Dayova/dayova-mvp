import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const MARKER = "qa-native-adaptive-20260925";

/** Re-enable only today's QA prompt after a successful native move. */
export const replayTodayPrompt = internalMutation({
	args: { userId: v.id("users") },
	returns: v.null(),
	handler: async (ctx, { userId }) => {
		if (
			process.env.CONVEX_CLOUD_URL !==
			"https://trustworthy-skunk-257.eu-west-1.convex.cloud"
		)
			throw new Error("Designated QA deployment required");
		if (
			Date.now() < Date.parse("2026-09-26T00:00:00Z") ||
			Date.now() >= Date.parse("2026-09-26T20:00:00Z")
		)
			throw new Error("Fixture expired");
		const user = await ctx.db.get("users", userId);
		if (
			user?.name !== "Philipp QA Elf" ||
			user.learningRoutineDismissedDateKey !== "2026-09-26"
		)
			throw new Error("Expected QA prompt after native move");
		const plans = await ctx.db
			.query("learningPlans")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", user.tokenIdentifier),
			)
			.take(100);
		if (!plans.some((p) => p.notes === "qa-native-only-today-20260926"))
			throw new Error("Fixture required");
		await ctx.db.patch("users", userId, {
			learningRoutineDismissedDateKey: undefined,
		});
		return null;
	},
});

/** Dated, insert-only fixture for native only-today acceptance. */
export const createToday = internalMutation({
	args: { userId: v.id("users") },
	returns: v.id("learningPlans"),
	handler: async (ctx, { userId }) => {
		if (
			![
				"https://trustworthy-skunk-257.convex.cloud",
				"https://trustworthy-skunk-257.eu-west-1.convex.cloud",
			].includes(process.env.CONVEX_CLOUD_URL ?? "")
		)
			throw new Error("Designated QA deployment required");
		const now = Date.now();
		if (
			now < Date.parse("2026-09-26T00:00:00Z") ||
			now >= Date.parse("2026-09-26T20:00:00Z")
		)
			throw new Error("Fixture expired");
		const user = await ctx.db.get("users", userId);
		if (user?.name !== "Philipp QA Elf")
			throw new Error("Designated QA account required");
		const ownerTokenIdentifier = user.tokenIdentifier;
		const plans = await ctx.db
			.query("learningPlans")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(100);
		const marker = "qa-native-only-today-20260926";
		const existing = plans.find((p) => p.notes === marker);
		if (existing) return existing._id;
		if (plans.length === 100) throw new Error("Unexpected QA count");
		const planId = await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier,
			subject: "QA Nur heute",
			examTypeLabel: "Test",
			examDateKey: "2026-10-05",
			examDateLabel: "5. Oktober 2026",
			durationMinutes: 20,
			topicDescription: "Synthetischer Test für einmaliges Verschieben",
			status: "accepted",
			notes: marker,
			createdAt: now,
			updatedAt: now,
		});
		const sessionId = await ctx.db.insert("learningPlanSessions", {
			ownerTokenIdentifier,
			learningPlanId: planId,
			phase: "practice",
			title: "QA Nur heute – Zeitwahl",
			dateKey: "2026-09-26T00:00:00.000Z",
			dateLabel: "26. September 2026",
			startTime: "17:00",
			durationMinutes: 20,
			goal: "Zeitwahl prüfen",
			tasks: [],
			expectedOutcome: "Nur diesen Termin verschieben",
			completed: false,
			executionStatus: "notStarted",
			planningStatus: "committed",
			sortOrder: 0,
			createdAt: now,
			updatedAt: now,
		});
		const entryId = await ctx.db.insert("dayEntries", {
			ownerTokenIdentifier,
			dayKey: "2026-09-26T00:00:00.000Z",
			title: "QA Nur heute – Zeitwahl",
			kind: "Lernen",
			time: "17:00",
			durationMinutes: 20,
			relatedLearningPlanId: planId,
			relatedLearningPlanSessionId: sessionId,
		});
		await ctx.db.patch("learningPlanSessions", sessionId, {
			dayEntryId: entryId,
		});
		return planId;
	},
});

/** Replay the synthetic observation case on another device after native undo. */
export const replayObservation = internalMutation({
	args: { userId: v.id("users") },
	returns: v.null(),
	handler: async (ctx, { userId }) => {
		if (
			![
				"https://trustworthy-skunk-257.convex.cloud",
				"https://trustworthy-skunk-257.eu-west-1.convex.cloud",
			].includes(process.env.CONVEX_CLOUD_URL ?? "")
		)
			throw new Error("Designated QA deployment required");
		if (Date.now() >= Date.parse("2026-09-28T00:00:00Z"))
			throw new Error("Fixture expired");
		const user = await ctx.db.get("users", userId);
		if (
			user?.name !== "Philipp QA Elf" ||
			user.behavioralLearningTimeUndo ||
			user.behavioralLearningTimeSuggestionSnoozedAt ||
			(user.behavioralLearningTimeSuggestionDismissedFingerprint &&
				user.behavioralLearningTimeSuggestionDismissedFingerprint !==
					"1:17:00-18:00|2:17:00-18:00|5:19:10-00:00=>1:18:00-19:00")
		)
			throw new Error("Expected QA account after undo");
		const plans = await ctx.db
			.query("learningPlans")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", user.tokenIdentifier),
			)
			.take(100);
		if (!plans.some((p) => p.notes === MARKER))
			throw new Error("Fixture required");
		const times = await ctx.db
			.query("userLearningTimes")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", user.tokenIdentifier),
			)
			.take(100);
		if (
			![1, 2].every((day) =>
				times.some(
					(t) =>
						t.dayOfWeek === day &&
						t.startTime === "17:00" &&
						t.endTime === "18:00",
				),
			)
		)
			throw new Error("Restore original times first");
		await ctx.db.patch("users", userId, {
			behavioralLearningTimeObservationStartedAt: undefined,
			behavioralLearningTimeSuggestionDismissedFingerprint: undefined,
		});
		return null;
	},
});

/** Switch only the known grade-11 QA exam between deadline and success cases. */
export const setGradeElevenExamCase = internalMutation({
	args: { planId: v.id("learningPlans"), future: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args) => {
		if (
			![
				"https://trustworthy-skunk-257.convex.cloud",
				"https://trustworthy-skunk-257.eu-west-1.convex.cloud",
			].includes(process.env.CONVEX_CLOUD_URL ?? "")
		)
			throw new Error("Designated QA deployment required");
		if (Date.now() >= Date.parse("2026-09-28T00:00:00Z"))
			throw new Error("Fixture expired");
		const plan = await ctx.db.get("learningPlans", args.planId);
		if (
			!plan ||
			plan.subject !== "Mathematik" ||
			plan.status !== "accepted" ||
			!["2026-09-25", "2026-10-05"].includes(plan.examDateKey)
		)
			throw new Error("Unexpected QA exam");
		const user = await ctx.db
			.query("users")
			.withIndex("by_tokenIdentifier", (q) =>
				q.eq("tokenIdentifier", plan.ownerTokenIdentifier),
			)
			.unique();
		if (user?.name !== "Philipp QA Elf")
			throw new Error("Grade eleven QA account required");
		const dateKey = args.future ? "2026-10-05" : "2026-09-25";
		const label = args.future ? "5. Oktober 2026" : "25. September 2026";
		if (plan.examDateKey === dateKey) return null;
		if (plan.examDayEntryId) {
			const entry = await ctx.db.get("dayEntries", plan.examDayEntryId);
			if (
				!entry ||
				entry.ownerTokenIdentifier !== plan.ownerTokenIdentifier ||
				entry.relatedLearningPlanId !== plan._id
			)
				throw new Error("Unexpected linked exam");
			await ctx.db.patch("dayEntries", entry._id, {
				dayKey: dateKey,
				plannedDateLabel: label,
			});
		}
		await ctx.db.patch("learningPlans", plan._id, {
			examDateKey: dateKey,
			examDateLabel: label,
			updatedAt: Date.now(),
		});
		return null;
	},
});

/** Explicit admin-only QA fixture. Never overwrites existing progress or times. */
export const create = internalMutation({
	args: { userId: v.id("users") },
	returns: v.id("learningPlans"),
	handler: async (ctx, { userId }) => {
		if (
			![
				"https://trustworthy-skunk-257.convex.cloud",
				"https://trustworthy-skunk-257.eu-west-1.convex.cloud",
			].includes(process.env.CONVEX_CLOUD_URL ?? "")
		)
			throw new Error("Fixture is restricted to the designated QA deployment.");
		const user = await ctx.db.get("users", userId);
		if (
			!user ||
			!["Philipp QA Sieben", "Philipp QA Zehn", "Philipp QA Elf"].includes(
				user.name ?? "",
			)
		)
			throw new Error("An explicitly designated QA account is required.");
		const ownerTokenIdentifier = user.tokenIdentifier;
		const plans = await ctx.db
			.query("learningPlans")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(100);
		const existing = plans.find((plan) => plan.notes === MARKER);
		if (existing) return existing._id;
		if (plans.length === 100) throw new Error("Unexpected QA plan count.");
		const times = await ctx.db
			.query("userLearningTimes")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(100);
		if (
			times.length === 100 ||
			times.some((row) => row.dayOfWeek === 1 || row.dayOfWeek === 2)
		)
			throw new Error(
				"Fixture requires unused Monday and Tuesday; existing times are preserved.",
			);
		if (
			user.behavioralLearningTimeObservationStartedAt ||
			user.behavioralLearningTimeSuggestionSnoozedAt
		)
			throw new Error("Existing behavioral state must not be overwritten.");
		const now = Date.now();
		if (
			now < Date.parse("2026-09-25T00:00:00Z") ||
			now >= Date.parse("2026-09-28T00:00:00Z")
		)
			throw new Error(
				"This dated fixture has expired; create a reviewed replacement.",
			);
		for (const dayOfWeek of [1, 2]) {
			await ctx.db.insert("userLearningTimes", {
				ownerTokenIdentifier,
				dayOfWeek,
				startTime: "17:00",
				endTime: "18:00",
				preferenceStatus: "confirmed",
				createdAt: now,
				updatedAt: now,
			});
		}
		const learningPlanId = await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier,
			subject: "QA Anpassung",
			examTypeLabel: "Test",
			examDateKey: "2026-10-05",
			examDateLabel: "5. Oktober 2026",
			durationMinutes: 60,
			topicDescription: "Synthetische QA-Daten zur Lernzeiten-Anpassung",
			status: "accepted",
			rollingPlanEnabled: true,
			notes: MARKER,
			createdAt: now,
			updatedAt: now,
		});
		const dates = [
			"2026-09-07",
			"2026-09-08",
			"2026-09-14",
			"2026-09-15",
			"2026-09-21",
			"2026-09-28",
			"2026-09-29",
		];
		for (const [sortOrder, dateKey] of dates.entries()) {
			const completed = sortOrder < 5;
			const startedAt = completed
				? Date.parse(`${dateKey}T16:00:00Z`)
				: undefined;
			await ctx.db.insert("learningPlanSessions", {
				ownerTokenIdentifier,
				learningPlanId,
				phase: "practice",
				title: `QA Lernzeit ${sortOrder + 1}`,
				dateKey,
				dateLabel: dateKey,
				startTime: "17:00",
				durationMinutes: 60,
				sessionPurpose: "learning",
				goal: "Synthetisches Lernmuster prüfen",
				tasks: ["QA-Aufgabe"],
				expectedOutcome: "Zustimmung und Fortschrittsschutz prüfen",
				completed,
				executionStatus: completed ? "completed" : "notStarted",
				startedAt,
				outcomeAt: startedAt === undefined ? undefined : startedAt + 3600000,
				planningStatus: "committed",
				sortOrder,
				createdAt: now,
				updatedAt: now,
			});
		}
		return learningPlanId;
	},
});
