import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getBerlinDayKey, getDayKeyQueryVariants } from "./dayKeyVariants";
import { throwUserFacingError } from "./errors";
import { assertNoScheduleConflict } from "./scheduleConflicts";

type OptionalEntryFields = {
	time?: string;
	kind?: string;
	notes?: string;
	dueDateKey?: string;
	dueDateLabel?: string;
	plannedDateLabel?: string;
	durationMinutes?: number;
	examTypeLabel?: string;
	completed?: boolean;
	relatedLearningPlanId?: Id<"learningPlans">;
	relatedLearningPlanSessionId?: Id<"learningPlanSessions">;
};

type PublicDayEntry = OptionalEntryFields & {
	id: Id<"dayEntries"> | Id<"learningPlanSessions">;
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
	...(entry.completed !== undefined ? { completed: entry.completed } : {}),
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

const publicLearningSessionEntry = (
	plan: Doc<"learningPlans">,
	session: Doc<"learningPlanSessions">,
): PublicDayEntry => ({
	id: session._id,
	title: `${plan.subject} ${session.title}`,
	time: session.startTime,
	kind: "Lernen",
	notes: [
		session.goal,
		...session.tasks.map((task) => `- ${task}`),
		session.expectedOutcome,
	].join("\n"),
	plannedDateLabel: session.dateLabel,
	durationMinutes: session.durationMinutes,
	completed: session.completed ?? false,
	relatedLearningPlanId: session.learningPlanId,
	relatedLearningPlanSessionId: session._id,
});

const getRequestedDayKey = (
	storedDayKey: string,
	queryKeyToRequestedDayKey: Map<string, string>,
) => {
	const directMatch = queryKeyToRequestedDayKey.get(storedDayKey);
	if (directMatch) return directMatch;

	const berlinDayKey = getBerlinDayKey(storedDayKey);
	return berlinDayKey ? queryKeyToRequestedDayKey.get(berlinDayKey) : undefined;
};

const optionalValuesMatch = <TValue>(
	left: TValue | undefined,
	right: TValue | undefined,
) => (left ?? undefined) === (right ?? undefined);

const isSameCreatePayload = (
	entry: Doc<"dayEntries">,
	args: OptionalEntryFields & { title: string },
) =>
	entry.title === args.title &&
	optionalValuesMatch(entry.time, args.time) &&
	optionalValuesMatch(entry.kind, args.kind) &&
	optionalValuesMatch(entry.notes, args.notes) &&
	optionalValuesMatch(entry.dueDateKey, args.dueDateKey) &&
	optionalValuesMatch(entry.dueDateLabel, args.dueDateLabel) &&
	optionalValuesMatch(entry.plannedDateLabel, args.plannedDateLabel) &&
	optionalValuesMatch(entry.durationMinutes, args.durationMinutes) &&
	optionalValuesMatch(entry.examTypeLabel, args.examTypeLabel) &&
	optionalValuesMatch(entry.completed, args.completed) &&
	optionalValuesMatch(
		entry.relatedLearningPlanId,
		args.relatedLearningPlanId,
	) &&
	optionalValuesMatch(
		entry.relatedLearningPlanSessionId,
		args.relatedLearningPlanSessionId,
	);

const findExistingSameEntry = async (
	ctx: QueryCtx | MutationCtx,
	{
		ownerTokenIdentifier,
		dayKey,
		args,
	}: {
		ownerTokenIdentifier: string;
		dayKey: string;
		args: OptionalEntryFields & { title: string };
	},
) => {
	for (const queryDayKey of getDayKeyQueryVariants(dayKey)) {
		const entries = await ctx.db
			.query("dayEntries")
			.withIndex("by_ownerTokenIdentifier_and_dayKey", (q) =>
				q
					.eq("ownerTokenIdentifier", ownerTokenIdentifier)
					.eq("dayKey", queryDayKey),
			)
			.take(100);

		const existing = entries.find((entry) => isSameCreatePayload(entry, args));
		if (existing) return existing;
	}

	return null;
};

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
	completed: v.optional(v.boolean()),
	relatedLearningPlanId: v.optional(v.id("learningPlans")),
	relatedLearningPlanSessionId: v.optional(v.id("learningPlanSessions")),
};

const requireOwnerTokenIdentifier = async (ctx: QueryCtx | MutationCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (identity === null) {
		throwUserFacingError("Nicht authentifiziert.");
	}

	return identity.tokenIdentifier;
};

export const listByDayKeys = query({
	args: {
		dayKeys: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		if (args.dayKeys.length > 31) {
			throwUserFacingError("Zu viele Tage auf einmal angefragt.");
		}

		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const grouped: Record<string, PublicDayEntry[]> = {};
		const queryKeyToRequestedDayKey = new Map<string, string>();
		for (const dayKey of args.dayKeys) {
			grouped[dayKey] = [];
			for (const queryDayKey of getDayKeyQueryVariants(dayKey)) {
				queryKeyToRequestedDayKey.set(queryDayKey, dayKey);
				const entries = await ctx.db
					.query("dayEntries")
					.withIndex("by_ownerTokenIdentifier_and_dayKey", (q) =>
						q
							.eq("ownerTokenIdentifier", ownerTokenIdentifier)
							.eq("dayKey", queryDayKey),
					)
					.take(100);

				grouped[dayKey].push(...entries.map(publicEntry));
			}
		}
		for (const dayKey of args.dayKeys) {
			const seenEntryIds = new Set<string>();
			grouped[dayKey] = grouped[dayKey].filter((entry) => {
				if (seenEntryIds.has(entry.id)) return false;
				seenEntryIds.add(entry.id);
				return true;
			});
		}

		const learningSessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(200);
		const planCache = new Map<
			Id<"learningPlans">,
			Doc<"learningPlans"> | null
		>();
		for (const session of learningSessions) {
			const requestedDayKey = getRequestedDayKey(
				session.dateKey,
				queryKeyToRequestedDayKey,
			);
			if (!requestedDayKey) continue;
			if (
				grouped[requestedDayKey]?.some(
					(entry) => entry.relatedLearningPlanSessionId === session._id,
				)
			) {
				continue;
			}

			let plan = planCache.get(session.learningPlanId);
			if (plan === undefined) {
				plan = await ctx.db.get("learningPlans", session.learningPlanId);
				planCache.set(session.learningPlanId, plan);
			}
			if (
				!plan ||
				plan.ownerTokenIdentifier !== ownerTokenIdentifier ||
				plan.status !== "accepted"
			) {
				continue;
			}

			grouped[requestedDayKey] = [
				...(grouped[requestedDayKey] ?? []),
				publicLearningSessionEntry(plan, session),
			];
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
			throwUserFacingError("Titel darf nicht leer sein.");
		}
		const existingSameEntry = await findExistingSameEntry(ctx, {
			ownerTokenIdentifier,
			dayKey: args.dayKey,
			args: { ...args, title },
		});
		if (existingSameEntry) {
			return existingSameEntry._id;
		}

		await assertNoScheduleConflict(ctx, {
			ownerTokenIdentifier,
			dayKey: args.dayKey,
			time: args.time,
			durationMinutes: args.durationMinutes,
		});

		return await ctx.db.insert("dayEntries", {
			ownerTokenIdentifier,
			dayKey: args.dayKey,
			title,
			...optionalEntryFields(args),
		});
	},
});

export const setCompleted = mutation({
	args: {
		id: v.id("dayEntries"),
		completed: v.boolean(),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const entry = await ctx.db.get("dayEntries", args.id);
		if (entry === null || entry.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Eintrag nicht gefunden.");
		}

		await ctx.db.patch("dayEntries", args.id, {
			completed: args.completed,
		});

		if (entry.relatedLearningPlanSessionId) {
			const session = await ctx.db.get(
				"learningPlanSessions",
				entry.relatedLearningPlanSessionId,
			);
			if (session?.ownerTokenIdentifier === ownerTokenIdentifier) {
				await ctx.db.patch("learningPlanSessions", session._id, {
					completed: args.completed,
					updatedAt: Date.now(),
				});
			}
		}

		return args.completed;
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
