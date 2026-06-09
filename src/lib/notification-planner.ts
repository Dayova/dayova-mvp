import { parseDayKey } from "./day-key";

export type NotificationPlanningPreferences = {
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

export type NotificationPlanningEntry = {
	id: string;
	title?: unknown;
	time?: string;
	kind?: string;
	durationMinutes?: number;
	completed?: boolean;
	relatedLearningPlanId?: string;
	relatedLearningPlanSessionId?: string;
};

export type PlannedLocalNotification = {
	key: string;
	type: "dailyBriefing" | "beforeEvent" | "forgottenEvent";
	category: "learningPlan" | "task" | "message";
	title: string;
	body: string;
	triggerAt: Date;
	relatedEntryId?: string;
};

const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

const parseTimeToMinutes = (time?: string) => {
	if (!time) return null;
	const match = TIME_PATTERN.exec(time.trim());
	if (!match) return null;
	const hour = Number(match[1]);
	const minute = Number(match[2]);
	if (hour > 23 || minute > 59) return null;
	return hour * 60 + minute;
};

const dateAtMinutes = (dayKey: string, minutes: number) => {
	const date = parseDayKey(dayKey);
	if (!date) return null;
	const next = new Date(date);
	next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
	return next;
};

const getEntryTitle = (entry: NotificationPlanningEntry) =>
	typeof entry.title === "string" && entry.title.trim().length > 0
		? entry.title.trim()
		: "Aufgabe";

const isLearningEntry = (entry: NotificationPlanningEntry) =>
	entry.kind === "Lernen" ||
	Boolean(entry.relatedLearningPlanId || entry.relatedLearningPlanSessionId);

const isExamEntry = (entry: NotificationPlanningEntry) =>
	entry.kind === "Leistungskontrolle";

const getCategory = (entry: NotificationPlanningEntry) =>
	isLearningEntry(entry) ? "learningPlan" : "task";

const getEventTitle = (entry: NotificationPlanningEntry) => {
	if (isLearningEntry(entry)) return "Lernplan";
	if (isExamEntry(entry)) return "Prüfung";
	if (entry.kind === "Hausaufgabe") return "Hausaufgabe";
	return "Aufgabe";
};

const shouldPlanBeforeEvent = (
	entry: NotificationPlanningEntry,
	preferences: NotificationPlanningPreferences,
) => {
	if (isLearningEntry(entry)) return preferences.beforeLearningTimeEnabled;
	if (isExamEntry(entry)) return preferences.beforeExamEnabled;
	if (entry.kind === "Hausaufgabe")
		return preferences.beforeHomeworkWorkEnabled;
	return true;
};

const formatEntryForBriefing = (entry: NotificationPlanningEntry) => {
	const title = getEntryTitle(entry);
	return entry.time ? `${title} um ${entry.time}` : title;
};

const getBriefingBody = (entries: NotificationPlanningEntry[]) => {
	const activeEntries = entries.filter((entry) => entry.completed !== true);
	if (activeEntries.length === 0) {
		return "Heute stehen keine offenen Einträge an.";
	}

	const sortedEntries = [...activeEntries].sort(
		(left, right) =>
			(parseTimeToMinutes(left.time) ?? 24 * 60) -
				(parseTimeToMinutes(right.time) ?? 24 * 60) ||
			getEntryTitle(left).localeCompare(getEntryTitle(right)),
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

export const buildLocalNotificationPlan = ({
	now,
	preferences,
	entriesByDay,
}: {
	now: Date;
	preferences: NotificationPlanningPreferences;
	entriesByDay: Record<string, NotificationPlanningEntry[]>;
}) => {
	if (!preferences.systemNotificationsEnabled) return [];

	const plan: PlannedLocalNotification[] = [];

	for (const [dayKey, entries] of Object.entries(entriesByDay)) {
		const briefingMinutes = parseTimeToMinutes(preferences.dailyBriefingTime);
		const briefingDate =
			briefingMinutes === null ? null : dateAtMinutes(dayKey, briefingMinutes);
		if (
			preferences.dailyBriefingEnabled &&
			briefingDate &&
			briefingDate.getTime() > now.getTime()
		) {
			plan.push({
				key: `briefing:${dayKey}:${preferences.dailyBriefingTime}`,
				type: "dailyBriefing",
				category: "message",
				title: "Tagesüberblick",
				body: getBriefingBody(entries),
				triggerAt: briefingDate,
			});
		}

		for (const entry of entries) {
			if (entry.completed === true) continue;
			const startMinutes = parseTimeToMinutes(entry.time);
			if (startMinutes === null) continue;

			if (shouldPlanBeforeEvent(entry, preferences)) {
				const beforeDate = dateAtMinutes(
					dayKey,
					startMinutes - preferences.reminderOffsetMinutes,
				);
				if (beforeDate && beforeDate.getTime() > now.getTime()) {
					const eventTitle = getEventTitle(entry);
					plan.push({
						key: `before:${entry.id}`,
						type: "beforeEvent",
						category: getCategory(entry),
						title: eventTitle,
						body: `Deine ${getEntryTitle(entry)} startet in ${preferences.reminderOffsetMinutes} Minuten.`,
						triggerAt: beforeDate,
						relatedEntryId: entry.id,
					});
				}
			}

			if (
				preferences.forgottenEventEnabled &&
				entry.durationMinutes !== undefined &&
				entry.durationMinutes > 0
			) {
				const forgottenDate = dateAtMinutes(
					dayKey,
					startMinutes + entry.durationMinutes + 15,
				);
				if (forgottenDate && forgottenDate.getTime() > now.getTime()) {
					const eventTitle = getEventTitle(entry);
					plan.push({
						key: `forgotten:${entry.id}`,
						type: "forgottenEvent",
						category: getCategory(entry),
						title: `${eventTitle} nicht vergessen`,
						body: `Du kannst deine ${getEntryTitle(entry)} noch als erledigt markieren.`,
						triggerAt: forgottenDate,
						relatedEntryId: entry.id,
					});
				}
			}
		}
	}

	return plan.sort(
		(left, right) =>
			left.triggerAt.getTime() - right.triggerAt.getTime() ||
			left.key.localeCompare(right.key),
	);
};
