import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

type OptionalEntryFields = {
	time?: string;
	kind?: string;
	notes?: string;
	dueDateKey?: string;
	dueDateLabel?: string;
	plannedDateLabel?: string;
	durationMinutes?: number;
	examTypeLabel?: string;
	relatedLearningPlanId?: Id<"learningPlans">;
	relatedLearningPlanSessionId?: Id<"learningPlanSessions">;
};

type PublicDayEntry = OptionalEntryFields & {
	id: Id<"dayEntries">;
	title: string;
};

const optionalEntryFields = (
	entry: OptionalEntryFields,
): OptionalEntryFields => ({
	...(entry.time !== undefined ? { time: entry.time } : {}),
	...(entry.kind !== undefined ? { kind: entry.kind } : {}),
	...(entry.notes !== undefined ? { notes: entry.notes } : {}),
	...(entry.dueDateKey !== undefined ? { dueDateKey: entry.dueDateKey } : {}),
	...(entry.dueDateLabel !== undefined
		? { dueDateLabel: entry.dueDateLabel }
		: {}),
	...(entry.plannedDateLabel !== undefined
		? { plannedDateLabel: entry.plannedDateLabel }
		: {}),
	...(entry.durationMinutes !== undefined
		? { durationMinutes: entry.durationMinutes }
		: {}),
	...(entry.examTypeLabel !== undefined
		? { examTypeLabel: entry.examTypeLabel }
		: {}),
	...(entry.relatedLearningPlanId !== undefined
		? { relatedLearningPlanId: entry.relatedLearningPlanId }
		: {}),
	...(entry.relatedLearningPlanSessionId !== undefined
		? { relatedLearningPlanSessionId: entry.relatedLearningPlanSessionId }
		: {}),
});

const publicEntry = (entry: Doc<"dayEntries">): PublicDayEntry => ({
	id: entry._id,
	title: entry.title,
	...optionalEntryFields(entry),
});

const entryFields = {
	title: v.string(),
	time: v.optional(v.string()),
	kind: v.optional(v.string()),
	notes: v.optional(v.string()),
	dueDateKey: v.optional(v.string()),
	dueDateLabel: v.optional(v.string()),
	plannedDateLabel: v.optional(v.string()),
	durationMinutes: v.optional(v.number()),
	examTypeLabel: v.optional(v.string()),
	relatedLearningPlanId: v.optional(v.id("learningPlans")),
	relatedLearningPlanSessionId: v.optional(v.id("learningPlanSessions")),
};

const requireOwnerTokenIdentifier = async (ctx: QueryCtx | MutationCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (identity === null) {
		throw new Error("Nicht authentifiziert.");
	}

	return identity.tokenIdentifier;
};

export const listByDayKeys = query({
	args: {
		dayKeys: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		if (args.dayKeys.length > 31) {
			throw new Error("Zu viele Tage auf einmal angefragt.");
		}

		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const grouped: Record<string, PublicDayEntry[]> = {};
		for (const dayKey of args.dayKeys) {
			const entries = await ctx.db
				.query("dayEntries")
				.withIndex("by_ownerTokenIdentifier_and_dayKey", (q) =>
					q
						.eq("ownerTokenIdentifier", ownerTokenIdentifier)
						.eq("dayKey", dayKey),
				)
				.take(100);

			grouped[dayKey] = entries.map(publicEntry);
		}

		return grouped;
	},
});

export const get = query({
	args: {
		id: v.id("dayEntries"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const entry = await ctx.db.get("dayEntries", args.id);
		if (entry === null || entry.ownerTokenIdentifier !== ownerTokenIdentifier) {
			return null;
		}

		return publicEntry(entry);
	},
});

export const create = mutation({
	args: {
		dayKey: v.string(),
		...entryFields,
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const title = args.title.trim();
		if (!title) {
			throw new Error("Titel darf nicht leer sein.");
		}

		return await ctx.db.insert("dayEntries", {
			ownerTokenIdentifier,
			dayKey: args.dayKey,
			title,
			...optionalEntryFields(args),
		});
	},
});

export const remove = mutation({
	args: {
		id: v.id("dayEntries"),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const entry = await ctx.db.get("dayEntries", args.id);
		if (entry === null || entry.ownerTokenIdentifier !== ownerTokenIdentifier) {
			return null;
		}

		await ctx.db.delete("dayEntries", args.id);
		return entry.dayKey;
	},
});
