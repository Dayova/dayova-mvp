import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getDayKeyQueryVariants } from "./dayKeyVariants";
import { throwUserFacingError } from "./errors";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

type NotificationPreferences = {
	systemNotificationsEnabled: boolean;
	dailyBriefingEnabled: boolean;
	dailyBriefingTime: string;
	beforeExamEnabled: boolean;
	beforeLearningTimeEnabled: boolean;
	beforeHomeworkWorkEnabled: boolean;
	beforeHomeworkDueEnabled: boolean;
	reminderOffsetMinutes: number;
	forgottenEventEnabled: boolean;
};

type NotificationCategory = "learningPlan" | "task" | "message";
type NotificationType = "dailyBriefing" | "beforeEvent" | "forgottenEvent";

const defaultPreferences: NotificationPreferences = {
	systemNotificationsEnabled: true,
	dailyBriefingEnabled: true,
	dailyBriefingTime: "07:30",
	beforeExamEnabled: true,
	beforeLearningTimeEnabled: true,
	beforeHomeworkWorkEnabled: true,
	beforeHomeworkDueEnabled: true,
	reminderOffsetMinutes: 15,
	forgottenEventEnabled: true,
};

const inboxCategoryValidator = v.union(
	v.literal("all"),
	v.literal("learningPlan"),
	v.literal("task"),
	v.literal("message"),
);

const notificationCategoryValidator = v.union(
	v.literal("learningPlan"),
	v.literal("task"),
	v.literal("message"),
);

const notificationTypeValidator = v.union(
	v.literal("dailyBriefing"),
	v.literal("beforeEvent"),
	v.literal("forgottenEvent"),
);

const requireOwnerTokenIdentifier = async (ctx: QueryCtx | MutationCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (identity === null) {
		throwUserFacingError("Nicht authentifiziert.");
	}

	return identity.tokenIdentifier;
};

const publicPreferences = (
	preferences: NotificationPreferences,
): NotificationPreferences => ({
	systemNotificationsEnabled: preferences.systemNotificationsEnabled,
	dailyBriefingEnabled: preferences.dailyBriefingEnabled,
	dailyBriefingTime: preferences.dailyBriefingTime,
	beforeExamEnabled: preferences.beforeExamEnabled,
	beforeLearningTimeEnabled: preferences.beforeLearningTimeEnabled,
	beforeHomeworkWorkEnabled: preferences.beforeHomeworkWorkEnabled,
	beforeHomeworkDueEnabled: preferences.beforeHomeworkDueEnabled,
	reminderOffsetMinutes: preferences.reminderOffsetMinutes,
	forgottenEventEnabled: preferences.forgottenEventEnabled,
});

const getPreferenceDocument = async (
	ctx: QueryCtx | MutationCtx,
	ownerTokenIdentifier: string,
) =>
	await ctx.db
		.query("notificationPreferences")
		.withIndex("by_ownerTokenIdentifier", (q) =>
			q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
		)
		.unique();

const parseTimeToMinutes = (time?: string) => {
	if (!time) return null;
	const match = timePattern.exec(time);
	if (!match) return null;
	return Number(match[1]) * 60 + Number(match[2]);
};

const parseTimestamp = (value: string) => {
	const timestamp = Date.parse(value);
	if (!Number.isFinite(timestamp)) {
		throwUserFacingError("Ungültige Zeit für Mitteilungen.");
	}
	return timestamp;
};

const isLearningEntry = (entry: Doc<"dayEntries">) =>
	entry.kind === "Lernen" ||
	Boolean(entry.relatedLearningPlanId || entry.relatedLearningPlanSessionId);

const isExamEntry = (entry: Doc<"dayEntries">) =>
	entry.kind === "Leistungskontrolle" || Boolean(entry.examTypeLabel);

const getEntryNotificationCategory = (
	entry: Doc<"dayEntries">,
): NotificationCategory => (isLearningEntry(entry) ? "learningPlan" : "task");

const getBeforeEventTitle = (entry: Doc<"dayEntries">) => {
	if (isLearningEntry(entry)) return "Lernplan";
	if (isExamEntry(entry)) return "Prüfung";
	if (entry.kind === "Hausaufgabe") return "Hausaufgabe";
	return "Aufgabe";
};

const formatEntryForBriefing = (entry: Doc<"dayEntries">) =>
	entry.time ? `${entry.title} um ${entry.time}` : entry.title;

const getDailyBriefingBody = (entries: Doc<"dayEntries">[]) => {
	const activeEntries = entries.filter((entry) => entry.completed !== true);
	if (activeEntries.length === 0) {
		return "Heute stehen keine offenen Einträge an.";
	}

	const sortedEntries = [...activeEntries].sort(
		(left, right) =>
			(parseTimeToMinutes(left.time) ?? 24 * 60) -
				(parseTimeToMinutes(right.time) ?? 24 * 60) ||
			left.title.localeCompare(right.title),
	);
	const preview = sortedEntries.slice(0, 3).map(formatEntryForBriefing);
	const suffix =
		sortedEntries.length > preview.length
			? ` und ${sortedEntries.length - preview.length} weitere`
			: "";
	const briefingLead =
		sortedEntries.length === 1
			? "Heute steht 1 Eintrag an"
			: `Heute stehen ${sortedEntries.length} Einträge an`;

	return `${briefingLead}: ${preview.join(", ")}${suffix}.`;
};

const shouldCreateBeforeEvent = (
	entry: Doc<"dayEntries">,
	preferences: NotificationPreferences,
) => {
	if (isLearningEntry(entry)) return preferences.beforeLearningTimeEnabled;
	if (isExamEntry(entry)) return preferences.beforeExamEnabled;
	if (entry.kind === "Hausaufgabe")
		return preferences.beforeHomeworkWorkEnabled;
	return true;
};

const publicNotification = (notification: Doc<"notificationHistory">) => ({
	id: notification._id,
	category: notification.category,
	type: notification.type,
	title: notification.title,
	body: notification.body,
	relatedDayEntryId: notification.relatedDayEntryId ?? null,
	relatedLearningPlanId: notification.relatedLearningPlanId ?? null,
	relatedLearningPlanSessionId:
		notification.relatedLearningPlanSessionId ?? null,
	triggeredAt: notification.triggeredAt,
	readAt: notification.readAt ?? null,
	deletedAt: notification.deletedAt ?? null,
	createdAt: notification.createdAt,
});

const getExistingEventNotification = async (
	ctx: MutationCtx,
	ownerTokenIdentifier: string,
	eventKey: string,
) =>
	await ctx.db
		.query("notificationHistory")
		.withIndex("by_ownerTokenIdentifier_and_eventKey", (q) =>
			q
				.eq("ownerTokenIdentifier", ownerTokenIdentifier)
				.eq("eventKey", eventKey),
		)
		.unique();

const insertNotificationOnce = async (
	ctx: MutationCtx,
	args: {
		ownerTokenIdentifier: string;
		eventKey: string;
		category: NotificationCategory;
		type: NotificationType;
		title: string;
		body: string;
		relatedDayEntryId?: Id<"dayEntries">;
		relatedLearningPlanId?: Id<"learningPlans">;
		relatedLearningPlanSessionId?: Id<"learningPlanSessions">;
		triggeredAt: number;
		createdAt: number;
	},
) => {
	const existing = await getExistingEventNotification(
		ctx,
		args.ownerTokenIdentifier,
		args.eventKey,
	);
	if (existing) return false;

	await ctx.db.insert("notificationHistory", args);
	return true;
};

const hasMatchingEventKey = (eventKey: string, type: NotificationType) => {
	if (type === "dailyBriefing") return eventKey.startsWith("briefing:");
	if (type === "beforeEvent") return eventKey.startsWith("before:");
	return eventKey.startsWith("forgotten:");
};

const hasMatchingCategory = (
	category: NotificationCategory,
	type: NotificationType,
) =>
	type === "dailyBriefing"
		? category === "message"
		: category === "learningPlan" || category === "task";

export const getPreferences = query({
	args: {},
	handler: async (ctx) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const preferences = await getPreferenceDocument(ctx, ownerTokenIdentifier);
		if (!preferences) return defaultPreferences;
		return publicPreferences(preferences);
	},
});

export const listInbox = query({
	args: {
		category: inboxCategoryValidator,
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const rows = await ctx.db
			.query("notificationHistory")
			.withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.order("desc")
			.take(100);

		return rows
			.filter(
				(row) =>
					row.deletedAt === undefined &&
					(args.category === "all" || row.category === args.category),
			)
			.map(publicNotification);
	},
});

export const getUnreadSummary = query({
	args: {},
	handler: async (ctx) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const rows = await ctx.db
			.query("notificationHistory")
			.withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.order("desc")
			.take(100);
		const unreadCount = rows.filter(
			(row) => row.deletedAt === undefined && row.readAt === undefined,
		).length;

		return {
			hasUnread: unreadCount > 0,
			unreadCount,
		};
	},
});

export const updatePreferences = mutation({
	args: {
		systemNotificationsEnabled: v.optional(v.boolean()),
		dailyBriefingEnabled: v.optional(v.boolean()),
		dailyBriefingTime: v.optional(v.string()),
		beforeExamEnabled: v.optional(v.boolean()),
		beforeLearningTimeEnabled: v.optional(v.boolean()),
		beforeHomeworkWorkEnabled: v.optional(v.boolean()),
		beforeHomeworkDueEnabled: v.optional(v.boolean()),
		reminderOffsetMinutes: v.optional(v.number()),
		forgottenEventEnabled: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		if (
			args.dailyBriefingTime !== undefined &&
			!timePattern.test(args.dailyBriefingTime)
		) {
			throwUserFacingError("Bitte gib eine gültige Uhrzeit ein.");
		}
		if (
			args.reminderOffsetMinutes !== undefined &&
			(!Number.isInteger(args.reminderOffsetMinutes) ||
				args.reminderOffsetMinutes < 1 ||
				args.reminderOffsetMinutes > 180)
		) {
			throwUserFacingError("Bitte wähle eine gültige Erinnerungszeit.");
		}

		const existing = await getPreferenceDocument(ctx, ownerTokenIdentifier);
		const now = Date.now();
		const nextPreferences = {
			...defaultPreferences,
			...(existing ? publicPreferences(existing) : {}),
			...args,
		};

		if (existing) {
			await ctx.db.patch("notificationPreferences", existing._id, {
				...nextPreferences,
				updatedAt: now,
			});
		} else {
			await ctx.db.insert("notificationPreferences", {
				ownerTokenIdentifier,
				...nextPreferences,
				createdAt: now,
				updatedAt: now,
			});
		}

		return nextPreferences;
	},
});

export const markAllRead = mutation({
	args: {
		now: v.string(),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const now = parseTimestamp(args.now);
		const rows = await ctx.db
			.query("notificationHistory")
			.withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.order("desc")
			.take(100);

		let updated = 0;
		for (const row of rows) {
			if (row.deletedAt !== undefined || row.readAt !== undefined) continue;
			await ctx.db.patch("notificationHistory", row._id, { readAt: now });
			updated += 1;
		}

		return { updated };
	},
});

export const deleteNotification = mutation({
	args: {
		id: v.id("notificationHistory"),
		now: v.string(),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const now = parseTimestamp(args.now);
		const notification = await ctx.db.get("notificationHistory", args.id);
		if (
			!notification ||
			notification.ownerTokenIdentifier !== ownerTokenIdentifier
		) {
			return null;
		}

		await ctx.db.patch("notificationHistory", args.id, {
			deletedAt: now,
			readAt: notification.readAt ?? now,
		});

		return args.id;
	},
});

export const recordDeliveredNotification = mutation({
	args: {
		eventKey: v.string(),
		category: notificationCategoryValidator,
		type: notificationTypeValidator,
		title: v.string(),
		body: v.string(),
		relatedDayEntryId: v.optional(v.id("dayEntries")),
		triggeredAt: v.string(),
	},
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		if (
			!hasMatchingEventKey(args.eventKey, args.type) ||
			!hasMatchingCategory(args.category, args.type) ||
			!args.title.trim() ||
			!args.body.trim()
		) {
			throwUserFacingError("Ungültige Mitteilung.");
		}

		const triggeredAt = parseTimestamp(args.triggeredAt);
		let relatedLearningPlanId: Id<"learningPlans"> | undefined;
		let relatedLearningPlanSessionId: Id<"learningPlanSessions"> | undefined;
		if (args.relatedDayEntryId) {
			const entry = await ctx.db.get("dayEntries", args.relatedDayEntryId);

			if (!entry) {
				throwUserFacingError("Zugehöriger Eintrag nicht gefunden.");
			}

			if (entry.ownerTokenIdentifier !== ownerTokenIdentifier) {
				throwUserFacingError("Mitteilung gehört zu einem anderen Konto.");
			}

			relatedLearningPlanId = entry.relatedLearningPlanId;
			relatedLearningPlanSessionId = entry.relatedLearningPlanSessionId;
		}

		const created = await insertNotificationOnce(ctx, {
			ownerTokenIdentifier,
			eventKey: args.eventKey,
			category: args.category,
			type: args.type,
			title: args.title.trim(),
			body: args.body.trim(),
			relatedDayEntryId: args.relatedDayEntryId,
			relatedLearningPlanId,
			relatedLearningPlanSessionId,
			triggeredAt,
			createdAt: triggeredAt,
		});

		return { created };
	},
});

export const syncDueNotifications = mutation({
	args: {
		now: v.string(),
		localDayKey: v.string(),
		localMinutes: v.number(),
	},
	handler: async (ctx, args) => {
		if (
			!Number.isInteger(args.localMinutes) ||
			args.localMinutes < 0 ||
			args.localMinutes > 24 * 60 - 1
		) {
			throwUserFacingError("Ungültige Uhrzeit für Mitteilungen.");
		}
		const now = parseTimestamp(args.now);

		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const storedPreferences = await getPreferenceDocument(
			ctx,
			ownerTokenIdentifier,
		);
		const preferences = storedPreferences
			? publicPreferences(storedPreferences)
			: defaultPreferences;

		let created = 0;
		const seenEntryIds = new Set<string>();
		const entriesForToday: Doc<"dayEntries">[] = [];
		for (const queryDayKey of getDayKeyQueryVariants(args.localDayKey)) {
			const entries = await ctx.db
				.query("dayEntries")
				.withIndex("by_ownerTokenIdentifier_and_dayKey", (q) =>
					q
						.eq("ownerTokenIdentifier", ownerTokenIdentifier)
						.eq("dayKey", queryDayKey),
				)
				.take(100);

			for (const entry of entries) {
				if (seenEntryIds.has(entry._id)) continue;
				seenEntryIds.add(entry._id);
				entriesForToday.push(entry);
			}
		}

		const briefingMinutes = parseTimeToMinutes(preferences.dailyBriefingTime);
		if (
			preferences.dailyBriefingEnabled &&
			briefingMinutes !== null &&
			args.localMinutes >= briefingMinutes &&
			args.localMinutes <= briefingMinutes + 60
		) {
			const didCreate = await insertNotificationOnce(ctx, {
				ownerTokenIdentifier,
				eventKey: `briefing:${args.localDayKey}:${preferences.dailyBriefingTime}`,
				category: "message",
				type: "dailyBriefing",
				title: "Tagesüberblick",
				body: getDailyBriefingBody(entriesForToday),
				triggeredAt: now,
				createdAt: now,
			});
			if (didCreate) created += 1;
		}

		for (const entry of entriesForToday) {
			if (entry.completed === true) continue;

			const startMinutes = parseTimeToMinutes(entry.time);
			if (startMinutes === null) continue;

			const beforeEventTriggerMinutes =
				startMinutes - preferences.reminderOffsetMinutes;
			if (
				shouldCreateBeforeEvent(entry, preferences) &&
				args.localMinutes >= beforeEventTriggerMinutes &&
				args.localMinutes <= startMinutes
			) {
				const didCreate = await insertNotificationOnce(ctx, {
					ownerTokenIdentifier,
					eventKey: `before:${entry._id}`,
					category: getEntryNotificationCategory(entry),
					type: "beforeEvent",
					title: getBeforeEventTitle(entry),
					body: `Deine ${entry.title} startet in ${preferences.reminderOffsetMinutes} Minuten.`,
					relatedDayEntryId: entry._id,
					relatedLearningPlanId: entry.relatedLearningPlanId,
					relatedLearningPlanSessionId: entry.relatedLearningPlanSessionId,
					triggeredAt: now,
					createdAt: now,
				});
				if (didCreate) created += 1;
			}

			const durationMinutes = entry.durationMinutes;
			if (
				preferences.forgottenEventEnabled &&
				durationMinutes !== undefined &&
				durationMinutes > 0
			) {
				const forgottenTriggerMinutes = startMinutes + durationMinutes + 15;
				if (args.localMinutes >= forgottenTriggerMinutes) {
					const didCreate = await insertNotificationOnce(ctx, {
						ownerTokenIdentifier,
						eventKey: `forgotten:${entry._id}`,
						category: getEntryNotificationCategory(entry),
						type: "forgottenEvent",
						title: `${getBeforeEventTitle(entry)} nicht vergessen`,
						body: `Du kannst deine ${entry.title} noch als erledigt markieren.`,
						relatedDayEntryId: entry._id,
						relatedLearningPlanId: entry.relatedLearningPlanId,
						relatedLearningPlanSessionId: entry.relatedLearningPlanSessionId,
						triggeredAt: now,
						createdAt: now,
					});
					if (didCreate) created += 1;
				}
			}
		}

		return { created };
	},
});
