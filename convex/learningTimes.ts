import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { throwUserFacingError } from "./errors";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

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
			.take(7);

		return rows
			.map((row) => ({
				id: row._id,
				dayOfWeek: row.dayOfWeek,
				startTime: row.startTime,
				endTime: row.endTime,
			}))
			.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
	},
});

export const upsertMine = mutation({
	args: {
		dayOfWeek: v.number(),
		startTime: v.string(),
		endTime: v.string(),
	},
	handler: async (ctx, args) => {
		validateLearningTime(args);

		const identity = await requireIdentity(ctx);
		const now = Date.now();
		const existing = await ctx.db
			.query("userLearningTimes")
			.withIndex("by_ownerTokenIdentifier_and_dayOfWeek", (q) =>
				q
					.eq("ownerTokenIdentifier", identity.tokenIdentifier)
					.eq("dayOfWeek", args.dayOfWeek),
			)
			.unique();

		if (existing) {
			await ctx.db.patch("userLearningTimes", existing._id, {
				startTime: args.startTime,
				endTime: args.endTime,
				updatedAt: now,
			});
			return existing._id;
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
		dayOfWeek: v.number(),
	},
	handler: async (ctx, args) => {
		if (
			!Number.isInteger(args.dayOfWeek) ||
			args.dayOfWeek < 1 ||
			args.dayOfWeek > 7
		) {
			throwUserFacingError("Bitte wähle einen gültigen Lerntag aus.");
		}

		const identity = await requireIdentity(ctx);
		const existing = await ctx.db
			.query("userLearningTimes")
			.withIndex("by_ownerTokenIdentifier_and_dayOfWeek", (q) =>
				q
					.eq("ownerTokenIdentifier", identity.tokenIdentifier)
					.eq("dayOfWeek", args.dayOfWeek),
			)
			.unique();

		if (!existing) return { success: true };

		await ctx.db.delete("userLearningTimes", existing._id);
		return { success: true };
	},
});
