import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const MARKER = "qa-native-adaptive-20260925";

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
