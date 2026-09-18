import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { assertAccountActive } from "./accountDeletion";
import { throwUserFacingError } from "./errors";
import { deriveBehavioralLearningTimeSuggestion } from "./learningTimeBehavior";
import { deriveProposedLearningTimes } from "./learningTimeAvailability";
import {
	parseLearningWindowEnd,
	parseLearningWindowTime,
} from "./learningTimePolicy";
import { markLearningTimesBackfillHandledForOwner } from "./learningTimesBackfill";

const MAX_LEARNING_TIMES = 50;
const MAX_BEHAVIOR_SESSIONS = 30;

const getBerlinDateTime = (date = new Date()) => {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Berlin",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value;
	const year = valueFor("year");
	const month = valueFor("month");
	const day = valueFor("day");
	const hour = Number(valueFor("hour"));
	const minute = Number(valueFor("minute"));
	if (
		!year ||
		!month ||
		!day ||
		!Number.isInteger(hour) ||
		!Number.isInteger(minute)
	) {
		throw new Error("Die aktuelle Zeit konnte nicht bestimmt werden.");
	}
	return {
		dateKey: `${year}-${month}-${day}`,
		timeMinutes: hour * 60 + minute,
	};
};

const requireIdentity = async (ctx: QueryCtx | MutationCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throwUserFacingError("Nicht authentifiziert.");
	}
	await assertAccountActive(ctx, identity.tokenIdentifier);
	return identity;
};

const timeSortValue = (time: string) => parseLearningWindowTime(time) ?? 0;

const validateLearningTime = (args: {
	dayOfWeek: number;
	startTime: string;
	endTime: string;
}) => {
	if (
		!Number.isInteger(args.dayOfWeek) ||
		args.dayOfWeek < 1 ||
		args.dayOfWeek > 7
	) {
		throwUserFacingError("Bitte wähle einen gültigen Lerntag aus.");
	}

	const startMinutes = parseLearningWindowTime(args.startTime);
	const endMinutes = parseLearningWindowEnd(args.startTime, args.endTime);
	if (startMinutes === null || endMinutes === null) {
		throwUserFacingError("Bitte gib gültige Uhrzeiten ein.");
	}

	if (endMinutes <= startMinutes) {
		throwUserFacingError("Die Endzeit muss nach der Startzeit liegen.");
	}

	return { startMinutes, endMinutes };
};

const assertNoOverlap = async (
	ctx: MutationCtx,
	args: {
		ownerTokenIdentifier: string;
		dayOfWeek: number;
		startMinutes: number;
		endMinutes: number;
		excludeId?: string;
	},
) => {
	const sameDayRows = await ctx.db
		.query("userLearningTimes")
		.withIndex("by_ownerTokenIdentifier_and_dayOfWeek", (q) =>
			q
				.eq("ownerTokenIdentifier", args.ownerTokenIdentifier)
				.eq("dayOfWeek", args.dayOfWeek),
		)
		.take(MAX_LEARNING_TIMES);

	const overlapping = sameDayRows.find((row) => {
		if (row._id === args.excludeId) return false;
		const start = parseLearningWindowTime(row.startTime);
		const end = parseLearningWindowEnd(row.startTime, row.endTime);
		if (start === null || end === null) return false;

		return args.startMinutes < end && args.endMinutes > start;
	});

	if (overlapping) {
		throwUserFacingError(
			"Diese Lernzeit überschneidet sich mit einer bestehenden Lernzeit.",
		);
	}
};

const rescheduleAfterChange = async (ctx: MutationCtx) => {
	const result: { rescheduledCount: number; unscheduledCount: number } =
		await ctx.runMutation(
			internal.learningPlans.rescheduleAfterLearningTimesChanged,
			{},
		);
	return result;
};

const getOwnerUser = async (
	ctx: QueryCtx | MutationCtx,
	ownerTokenIdentifier: string,
) =>
	await ctx.db
		.query("users")
		.withIndex("by_tokenIdentifier", (q) =>
			q.eq("tokenIdentifier", ownerTokenIdentifier),
		)
		.unique();

const markIntroPromptHandled = async (
	ctx: MutationCtx,
	ownerTokenIdentifier: string,
	handledAt: number,
) => {
	const user = await getOwnerUser(ctx, ownerTokenIdentifier);
	if (!user || user.learningTimeIntroPromptHandledAt !== undefined) return;
	await ctx.db.patch("users", user._id, {
		learningTimeIntroPromptHandledAt: handledAt,
	});
};

const getBehavioralSuggestion = async (
	ctx: QueryCtx | MutationCtx,
	ownerTokenIdentifier: string,
) => {
	const [learningTimes, sessions, user] = await Promise.all([
		ctx.db
			.query("userLearningTimes")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(MAX_LEARNING_TIMES),
		ctx.db
			.query("learningPlanSessions")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.order("desc")
			.take(MAX_BEHAVIOR_SESSIONS),
		getOwnerUser(ctx, ownerTokenIdentifier),
	]);
	return {
		suggestion: deriveBehavioralLearningTimeSuggestion({
			sessions: sessions.map((session) => ({
				dateKey: session.dateKey,
				startTime: session.startTime,
				durationMinutes: session.durationMinutes,
				startedAt: session.startedAt,
				executionStatus:
					session.executionStatus ??
					(session.completed ? "completed" : "notStarted"),
				planningStatus: session.planningStatus,
			})),
			learningTimes,
			grade: user?.grade,
		}),
		learningTimes,
		user,
	};
};

const ensureProposedDefaults = async (
	ctx: MutationCtx,
	args: {
		ownerTokenIdentifier: string;
		learningPlanId: Id<"learningPlans">;
		examDateKey: string;
	},
) => {
	const existingRows = await ctx.db
		.query("userLearningTimes")
		.withIndex("by_ownerTokenIdentifier", (q) =>
			q.eq("ownerTokenIdentifier", args.ownerTokenIdentifier),
		)
		.take(MAX_LEARNING_TIMES);
	if (existingRows.length > 0) return existingRows;

	const now = getBerlinDateTime();
	const proposals = deriveProposedLearningTimes({
		currentDateKey: now.dateKey,
		currentTimeMinutes: now.timeMinutes,
		examDateKey: args.examDateKey,
		grade: (await getOwnerUser(ctx, args.ownerTokenIdentifier))?.grade,
	});
	if (proposals.length === 0) {
		throwUserFacingError(
			"Vor dieser Prüfung bleibt heute kein verlässliches Lernfenster mehr. Verschiebe den Prüfungstermin oder trage eine passende Lernzeit ein.",
		);
	}

	const createdAt = Date.now();
	for (const proposal of proposals) {
		await ctx.db.insert("userLearningTimes", {
			ownerTokenIdentifier: args.ownerTokenIdentifier,
			...proposal,
			preferenceStatus: "systemDefault",
			proposedForLearningPlanId: args.learningPlanId,
			createdAt,
			updatedAt: createdAt,
		});
	}

	return await ctx.db
		.query("userLearningTimes")
		.withIndex("by_ownerTokenIdentifier", (q) =>
			q.eq("ownerTokenIdentifier", args.ownerTokenIdentifier),
		)
		.take(MAX_LEARNING_TIMES);
};

export const ensureProposedDefaultsForPlan = internalMutation({
	args: { learningPlanId: v.id("learningPlans") },
	returns: v.number(),
	handler: async (ctx, args) => {
		const identity = await requireIdentity(ctx);
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== identity.tokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}
		const rows = await ensureProposedDefaults(ctx, {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId: args.learningPlanId,
			examDateKey: plan.examDateKey,
		});
		return rows.length;
	},
});

export const prepareDefaultsForPlan = mutation({
	args: { learningPlanId: v.id("learningPlans") },
	returns: v.array(
		v.object({
			id: v.id("userLearningTimes"),
			dayOfWeek: v.number(),
			startTime: v.string(),
			endTime: v.string(),
			preferenceStatus: v.union(
				v.literal("systemDefault"),
				v.literal("confirmed"),
			),
		}),
	),
	handler: async (ctx, args) => {
		const identity = await requireIdentity(ctx);
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== identity.tokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}
		const rows = await ensureProposedDefaults(ctx, {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId: args.learningPlanId,
			examDateKey: plan.examDateKey,
		});
		return rows.map((row) => ({
			id: row._id,
			dayOfWeek: row.dayOfWeek,
			startTime: row.startTime,
			endTime: row.endTime,
			preferenceStatus: row.preferenceStatus ?? "confirmed",
		}));
	},
});

export const listMine = query({
	args: {},
	returns: v.array(
		v.object({
			id: v.id("userLearningTimes"),
			dayOfWeek: v.number(),
			startTime: v.string(),
			endTime: v.string(),
			preferenceStatus: v.optional(v.literal("systemDefault")),
		}),
	),
	handler: async (ctx) => {
		const identity = await requireIdentity(ctx);
		const rows = await ctx.db
			.query("userLearningTimes")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", identity.tokenIdentifier),
			)
			.take(MAX_LEARNING_TIMES);

		return rows
			.map((row) => ({
				id: row._id,
				dayOfWeek: row.dayOfWeek,
				startTime: row.startTime,
				endTime: row.endTime,
				...(row.preferenceStatus === "systemDefault"
					? { preferenceStatus: "systemDefault" as const }
					: {}),
			}))
			.sort(
				(a, b) =>
					a.dayOfWeek - b.dayOfWeek ||
					timeSortValue(a.startTime) - timeSortValue(b.startTime),
			);
	},
});

export const upsertMine = mutation({
	args: {
		id: v.optional(v.id("userLearningTimes")),
		dayOfWeek: v.number(),
		startTime: v.string(),
		endTime: v.string(),
	},
	returns: v.id("userLearningTimes"),
	handler: async (ctx, args) => {
		const { startMinutes, endMinutes } = validateLearningTime(args);

		const identity = await requireIdentity(ctx);
		const now = Date.now();
		const existing = args.id
			? await ctx.db.get("userLearningTimes", args.id)
			: null;
		if (
			args.id &&
			(!existing || existing.ownerTokenIdentifier !== identity.tokenIdentifier)
		) {
			throwUserFacingError("Lernzeit nicht gefunden.");
		}

		await assertNoOverlap(ctx, {
			ownerTokenIdentifier: identity.tokenIdentifier,
			dayOfWeek: args.dayOfWeek,
			startMinutes,
			endMinutes,
			excludeId: args.id,
		});

		if (existing) {
			await ctx.db.patch("userLearningTimes", existing._id, {
				dayOfWeek: args.dayOfWeek,
				startTime: args.startTime,
				endTime: args.endTime,
				preferenceStatus: "confirmed",
				proposedForLearningPlanId: undefined,
				updatedAt: now,
			});
			for (const row of await ctx.db
				.query("userLearningTimes")
				.withIndex("by_ownerTokenIdentifier", (q) =>
					q.eq("ownerTokenIdentifier", identity.tokenIdentifier),
				)
				.take(MAX_LEARNING_TIMES)) {
				if (row.preferenceStatus === "systemDefault") {
					await ctx.db.patch("userLearningTimes", row._id, {
						preferenceStatus: "confirmed",
						proposedForLearningPlanId: undefined,
						updatedAt: now,
					});
				}
			}
			await markLearningTimesBackfillHandledForOwner(
				ctx,
				identity.tokenIdentifier,
			);
			await rescheduleAfterChange(ctx);
			return existing._id;
		}

		const existingRows = await ctx.db
			.query("userLearningTimes")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", identity.tokenIdentifier),
			)
			.take(MAX_LEARNING_TIMES);
		if (existingRows.length >= MAX_LEARNING_TIMES) {
			throwUserFacingError(
				"Du hast die maximale Anzahl an Lernzeiten erreicht.",
			);
		}

		const learningTimeId = await ctx.db.insert("userLearningTimes", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			dayOfWeek: args.dayOfWeek,
			startTime: args.startTime,
			endTime: args.endTime,
			preferenceStatus: "confirmed",
			createdAt: now,
			updatedAt: now,
		});
		for (const row of existingRows) {
			if (row.preferenceStatus === "systemDefault") {
				await ctx.db.patch("userLearningTimes", row._id, {
					preferenceStatus: "confirmed",
					proposedForLearningPlanId: undefined,
					updatedAt: now,
				});
			}
		}
		await markLearningTimesBackfillHandledForOwner(
			ctx,
			identity.tokenIdentifier,
		);
		await rescheduleAfterChange(ctx);
		return learningTimeId;
	},
});

export const confirmProposedDefaults = mutation({
	args: { learningPlanId: v.id("learningPlans") },
	returns: v.number(),
	handler: async (ctx, args) => {
		const identity = await requireIdentity(ctx);
		const plan = await ctx.db.get("learningPlans", args.learningPlanId);
		if (!plan || plan.ownerTokenIdentifier !== identity.tokenIdentifier) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}
		const rows = await ctx.db
			.query("userLearningTimes")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", identity.tokenIdentifier),
			)
			.take(MAX_LEARNING_TIMES);
		const confirmedAt = Date.now();
		for (const row of rows) {
			if (row.preferenceStatus === "systemDefault") {
				await ctx.db.patch("userLearningTimes", row._id, {
					preferenceStatus: "confirmed",
					proposedForLearningPlanId: undefined,
					updatedAt: confirmedAt,
				});
			}
		}
		await ctx.db.patch("learningPlans", args.learningPlanId, {
			initialLearningTimePromptDismissedAt:
				plan.initialLearningTimePromptDismissedAt ?? confirmedAt,
			postDiagnosticLearningTimeReminderDismissedAt: confirmedAt,
			updatedAt: confirmedAt,
		});
		await markIntroPromptHandled(ctx, identity.tokenIdentifier, confirmedAt);
		return rows.filter((row) => row.preferenceStatus === "systemDefault")
			.length;
	},
});

export const applyBehavioralSuggestion = mutation({
	args: { fingerprint: v.string() },
	returns: v.object({
		rescheduledCount: v.number(),
		unscheduledCount: v.number(),
	}),
	handler: async (ctx, args) => {
		const identity = await requireIdentity(ctx);
		const { suggestion, learningTimes, user } = await getBehavioralSuggestion(
			ctx,
			identity.tokenIdentifier,
		);
		if (!suggestion || suggestion.fingerprint !== args.fingerprint) {
			throwUserFacingError(
				"Dieser Lernzeiten-Vorschlag ist nicht mehr aktuell. Öffne deinen Lernplan erneut.",
			);
		}
		const updatedAt = Date.now();
		for (const learningTime of learningTimes) {
			await ctx.db.delete("userLearningTimes", learningTime._id);
		}
		for (const entry of suggestion.entries) {
			await ctx.db.insert("userLearningTimes", {
				ownerTokenIdentifier: identity.tokenIdentifier,
				...entry,
				preferenceStatus: "confirmed",
				createdAt: updatedAt,
				updatedAt,
			});
		}
		if (user) {
			await ctx.db.patch("users", user._id, {
				behavioralLearningTimeSuggestionDismissedFingerprint:
					suggestion.fingerprint,
				behavioralLearningTimeSuggestionSnoozedFingerprint: undefined,
				behavioralLearningTimeSuggestionSnoozedAt: undefined,
			});
		}
		await markLearningTimesBackfillHandledForOwner(
			ctx,
			identity.tokenIdentifier,
		);
		return await rescheduleAfterChange(ctx);
	},
});

export const respondToBehavioralSuggestion = mutation({
	args: {
		fingerprint: v.string(),
		response: v.union(v.literal("keep"), v.literal("later")),
	},
	returns: v.object({ success: v.boolean() }),
	handler: async (ctx, args) => {
		const identity = await requireIdentity(ctx);
		const { suggestion, user } = await getBehavioralSuggestion(
			ctx,
			identity.tokenIdentifier,
		);
		if (!user) throwUserFacingError("Profil nicht gefunden.");
		if (!suggestion || suggestion.fingerprint !== args.fingerprint) {
			return { success: true };
		}
		const respondedAt = Date.now();
		await ctx.db.patch("users", user._id, {
			...(args.response === "keep"
				? {
						behavioralLearningTimeSuggestionDismissedFingerprint:
							suggestion.fingerprint,
						behavioralLearningTimeSuggestionSnoozedFingerprint: undefined,
						behavioralLearningTimeSuggestionSnoozedAt: undefined,
					}
				: {
						behavioralLearningTimeSuggestionSnoozedFingerprint:
							suggestion.fingerprint,
						behavioralLearningTimeSuggestionSnoozedAt: respondedAt,
					}),
		});
		return { success: true };
	},
});

export const removeMine = mutation({
	args: {
		id: v.id("userLearningTimes"),
	},
	returns: v.object({ success: v.boolean() }),
	handler: async (ctx, args) => {
		const identity = await requireIdentity(ctx);
		const existing = await ctx.db.get("userLearningTimes", args.id);

		if (
			!existing ||
			existing.ownerTokenIdentifier !== identity.tokenIdentifier
		) {
			return { success: true };
		}

		await ctx.db.delete("userLearningTimes", existing._id);
		await markLearningTimesBackfillHandledForOwner(
			ctx,
			identity.tokenIdentifier,
		);
		await rescheduleAfterChange(ctx);
		return { success: true };
	},
});
