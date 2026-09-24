import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { throwUserFacingError } from "./errors";
import { deriveProposedLearningTimes } from "./learningTimeAvailability";
import {
	BEHAVIOR_OBSERVATION_WINDOW_MS,
	deriveBehavioralLearningTimeSuggestion,
	isBehavioralSuggestionSnoozed,
} from "./learningTimeBehavior";
import {
	parseLearningWindowEnd,
	parseLearningWindowTime,
} from "./learningTimePolicy";
import { markLearningTimesBackfillHandledForOwner } from "./learningTimesBackfill";

const MAX_LEARNING_TIMES = 50;
const MAX_BEHAVIOR_SESSIONS = 30;

// Include row identity and revision so undo cannot overwrite subsequent edits.
const scheduleSignature = (rows: Doc<"userLearningTimes">[]) =>
	JSON.stringify(
		[...rows]
			.sort((a, b) => a._id.localeCompare(b._id))
			.map((row) => [
				row._id,
				row.dayOfWeek,
				row.startTime,
				row.endTime,
				row.preferenceStatus,
				row.updatedAt,
			]),
	);
const getOwnerTimes = (
	ctx: QueryCtx | MutationCtx,
	ownerTokenIdentifier: string,
) =>
	ctx.db
		.query("userLearningTimes")
		.withIndex("by_ownerTokenIdentifier", (q) =>
			q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
		)
		.take(MAX_LEARNING_TIMES);

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
	referenceTime: number,
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
			.withIndex("by_ownerTokenIdentifier_and_startedAt", (q) =>
				q
					.eq("ownerTokenIdentifier", ownerTokenIdentifier)
					.gte("startedAt", referenceTime - BEHAVIOR_OBSERVATION_WINDOW_MS)
					.lte("startedAt", referenceTime),
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
			referenceTime,
			observationStartedAt: user?.behavioralLearningTimeObservationStartedAt,
		}),
		learningTimes,
		user,
	};
};

const beginFreshObservation = async (
	ctx: MutationCtx,
	ownerTokenIdentifier: string,
	now: number,
) => {
	const user = await getOwnerUser(ctx, ownerTokenIdentifier);
	if (user)
		await ctx.db.patch("users", user._id, {
			behavioralLearningTimeObservationStartedAt: now,
			behavioralLearningTimeUndo: undefined,
		});
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
		await beginFreshObservation(ctx, identity.tokenIdentifier, now);

		if (existing) {
			await ctx.db.patch("userLearningTimes", existing._id, {
				dayOfWeek: args.dayOfWeek,
				startTime: args.startTime,
				endTime: args.endTime,
				preferenceStatus: "confirmed",
				proposedForLearningPlanId: undefined,
				updatedAt: now,
			});
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
		await beginFreshObservation(ctx, identity.tokenIdentifier, confirmedAt);
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
			Date.now(),
		);
		if (
			!suggestion ||
			!user ||
			suggestion.fingerprint !== args.fingerprint ||
			user?.behavioralLearningTimeSuggestionDismissedFingerprint ===
				args.fingerprint ||
			isBehavioralSuggestionSnoozed(
				user?.behavioralLearningTimeSuggestionSnoozedAt,
				Date.now(),
			)
		) {
			throwUserFacingError(
				"Dieser Lernzeiten-Vorschlag ist nicht mehr aktuell. Öffne deinen Lernplan erneut.",
			);
		}
		const updatedAt = Date.now();
		const undoEntries = [];
		for (const entry of suggestion.entries) {
			const existing = learningTimes.find(
				(time) => time.dayOfWeek === entry.dayOfWeek,
			);
			if (!existing)
				throwUserFacingError(
					"Dieser Lernzeiten-Vorschlag ist nicht mehr aktuell.",
				);
			undoEntries.push({
				id: existing._id,
				startTime: existing.startTime,
				endTime: existing.endTime,
				preferenceStatus: existing.preferenceStatus,
				proposedForLearningPlanId: existing.proposedForLearningPlanId,
			});
			await ctx.db.patch("userLearningTimes", existing._id, {
				startTime: entry.startTime,
				endTime: entry.endTime,
				preferenceStatus: "confirmed",
				proposedForLearningPlanId: undefined,
				updatedAt,
			});
		}
		if (user) {
			await ctx.db.patch("users", user._id, {
				behavioralLearningTimeObservationStartedAt: updatedAt,
				behavioralLearningTimeUndo: {
					expectedSchedule: scheduleSignature(
						await getOwnerTimes(ctx, identity.tokenIdentifier),
					),
					entries: undoEntries,
				},
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
		const result = await rescheduleAfterChange(ctx);
		if (result.unscheduledCount > 0) {
			// Throwing rolls back both preference and calendar changes atomically.
			throwUserFacingError(
				"Mit diesen Zeiten passen nicht alle Lernschritte vor deine Prüfungen. Deine bisherigen Zeiten bleiben unverändert. Bitte passe die Zeiten individuell an.",
			);
		}
		return result;
	},
});

export const canUndoBehavioralSuggestion = query({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => {
		const identity = await requireIdentity(ctx);
		const user = await getOwnerUser(ctx, identity.tokenIdentifier);
		const undo = user?.behavioralLearningTimeUndo;
		return (
			!!undo &&
			undo.expectedSchedule ===
				scheduleSignature(await getOwnerTimes(ctx, identity.tokenIdentifier))
		);
	},
});

export const undoBehavioralSuggestion = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const identity = await requireIdentity(ctx);
		const user = await getOwnerUser(ctx, identity.tokenIdentifier);
		const undo = user?.behavioralLearningTimeUndo;
		if (
			!user ||
			!undo ||
			undo.expectedSchedule !==
				scheduleSignature(await getOwnerTimes(ctx, identity.tokenIdentifier))
		) {
			throwUserFacingError(
				"Deine Lernzeiten wurden inzwischen geändert. Bitte passe sie in den Einstellungen an.",
			);
		}
		const now = Date.now();
		for (const entry of undo.entries) {
			const { id, ...previous } = entry;
			const row = await ctx.db.get("userLearningTimes", id);
			if (!row || row.ownerTokenIdentifier !== identity.tokenIdentifier)
				throwUserFacingError("Lernzeit nicht gefunden.");
			await ctx.db.patch("userLearningTimes", id, {
				...previous,
				updatedAt: now,
			});
		}
		const result = await rescheduleAfterChange(ctx);
		if (result.unscheduledCount > 0)
			throwUserFacingError(
				"Die vorherigen Zeiten passen nicht mehr zu allen Prüfungsfristen. Bitte passe sie in den Einstellungen an.",
			);
		await ctx.db.patch("users", user._id, {
			behavioralLearningTimeUndo: undefined,
			behavioralLearningTimeObservationStartedAt: now,
		});
		return null;
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
			Date.now(),
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
		await beginFreshObservation(ctx, identity.tokenIdentifier, Date.now());
		await markLearningTimesBackfillHandledForOwner(
			ctx,
			identity.tokenIdentifier,
		);
		await rescheduleAfterChange(ctx);
		return { success: true };
	},
});
