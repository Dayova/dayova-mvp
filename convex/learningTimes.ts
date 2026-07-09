import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { throwUserFacingError } from "./errors";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_LEARNING_TIMES = 50;

const requireIdentity = async (ctx: QueryCtx | MutationCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throwUserFacingError("Nicht authentifiziert.");
	}
	return identity;
};

const parseTimeToMinutes = (time: string) => {
	const match = timePattern.exec(time);
	if (!match) return null;

	return Number(match[1]) * 60 + Number(match[2]);
};

const timeSortValue = (time: string) => parseTimeToMinutes(time) ?? 0;

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

	const startMinutes = parseTimeToMinutes(args.startTime);
	const endMinutes = parseTimeToMinutes(args.endTime);
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
		const start = parseTimeToMinutes(row.startTime);
		const end = parseTimeToMinutes(row.endTime);
		if (start === null || end === null) return false;

		return args.startMinutes < end && args.endMinutes > start;
	});

	if (overlapping) {
		throwUserFacingError(
			"Diese Lernzeit überschneidet sich mit einer bestehenden Lernzeit.",
		);
	}
};

export const listMine = query({
	args: {},
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
				updatedAt: now,
			});
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

		return await ctx.db.insert("userLearningTimes", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			dayOfWeek: args.dayOfWeek,
			startTime: args.startTime,
			endTime: args.endTime,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const removeMine = mutation({
	args: {
		id: v.id("userLearningTimes"),
	},
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
		return { success: true };
	},
});
