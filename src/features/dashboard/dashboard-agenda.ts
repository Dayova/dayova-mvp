import { addDays, getDayKey, parseDayKey } from "~/lib/day-key";
import type { DayEntry } from "~/types/dayEntries";

export type DashboardAgendaKind =
	| "schoolLesson"
	| "learningSession"
	| "exam"
	| "homework";

export type DashboardAgendaItem = {
	dayKey: string;
	entry: DayEntry;
	kind: DashboardAgendaKind;
	startMinutes: number | null;
	endMinutes: number | null;
};

export const getAdjacentDashboardDayKey = ({
	selectedDayKey,
	direction,
}: {
	selectedDayKey: string;
	direction: "next" | "previous";
}) => {
	const selectedDate = parseDayKey(selectedDayKey);
	if (!selectedDate) return selectedDayKey;

	return getDayKey(addDays(selectedDate, direction === "next" ? 1 : -1));
};

export const getDashboardWeekDayKeys = (selectedDayKey: string) => {
	const selectedDate = parseDayKey(selectedDayKey);
	if (!selectedDate) return [selectedDayKey];

	const weekStart = addDays(selectedDate, -selectedDate.getDay());
	return Array.from({ length: 7 }, (_, index) =>
		getDayKey(addDays(weekStart, index)),
	);
};

export const getDashboardCalendarDayKeys = ({
	anchorDayKey,
	radiusInDays = 730,
}: {
	anchorDayKey: string;
	radiusInDays?: number;
}) => {
	const anchorDate = parseDayKey(anchorDayKey);
	if (!anchorDate) return [anchorDayKey];

	const safeRadius = Math.max(Math.floor(radiusInDays), 0);
	const firstDate = addDays(anchorDate, -safeRadius);
	return Array.from({ length: safeRadius * 2 + 1 }, (_, index) =>
		getDayKey(addDays(firstDate, index)),
	);
};

export const getDashboardRelevantDayKeys = ({
	selectedDayKey,
	todayKey,
	lookaheadDays = 30,
}: {
	selectedDayKey: string;
	todayKey: string;
	lookaheadDays?: number;
}) => {
	const selectedDate = parseDayKey(selectedDayKey);
	const today = parseDayKey(todayKey);
	const keys = new Set<string>();
	const addKey = (dayKey: string) => {
		if (keys.size < 31) keys.add(dayKey);
	};

	if (selectedDate) {
		for (const offset of [-1, 0, 1]) {
			addKey(getDayKey(addDays(selectedDate, offset)));
		}
	} else {
		addKey(selectedDayKey);
	}
	if (today) {
		const safeLookahead = Math.max(Math.floor(lookaheadDays), 0);
		for (let offset = 0; offset <= safeLookahead; offset += 1) {
			addKey(getDayKey(addDays(today, offset)));
		}
	} else {
		addKey(todayKey);
	}

	return [...keys].sort();
};

const SCHOOL_LESSON_PATTERN =
	/\b(unterricht|schulstunde|stunde|school lesson|lesson)\b/i;
const LEARNING_SESSION_PATTERN =
	/\b(lernen|lernsession|lernslot|theorie|übung|uebung|praxis|probe|rehearsal|practice)\b/i;
const EXAM_PATTERN =
	/\b(leistungskontrolle|kurzkontrolle|test|klausur|quiz|prüfung|pruefung|vorabi|abitur)\b/i;

export const getAgendaEntryTitle = (entry: DayEntry) =>
	typeof entry.title === "string" && entry.title.trim().length > 0
		? entry.title.trim()
		: "Aufgabe";

export const parseAgendaTime = (time?: string) => {
	if (!time || time.trim().toLowerCase() === "ganztägig") return null;
	const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
	if (!match) return null;

	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (hours > 23 || minutes > 59) return null;
	return hours * 60 + minutes;
};

export const classifyAgendaEntry = (entry: DayEntry): DashboardAgendaKind => {
	const searchableText = `${entry.kind ?? ""} ${getAgendaEntryTitle(entry)}`;

	if (
		entry.relatedLearningPlanSessionId ||
		LEARNING_SESSION_PATTERN.test(searchableText)
	) {
		return "learningSession";
	}
	if (SCHOOL_LESSON_PATTERN.test(searchableText)) return "schoolLesson";
	if (entry.examTypeLabel || EXAM_PATTERN.test(searchableText)) return "exam";
	return "homework";
};

export const toDashboardAgendaItem = (
	dayKey: string,
	entry: DayEntry,
): DashboardAgendaItem => {
	const startMinutes = parseAgendaTime(entry.time);
	return {
		dayKey,
		entry,
		kind: classifyAgendaEntry(entry),
		startMinutes,
		endMinutes:
			startMinutes === null
				? null
				: startMinutes + Math.max(entry.durationMinutes ?? 45, 15),
	};
};

export const sortDashboardAgendaItems = (
	items: DashboardAgendaItem[],
): DashboardAgendaItem[] =>
	[...items].sort((left, right) => {
		if (left.startMinutes === right.startMinutes) {
			return getAgendaEntryTitle(left.entry).localeCompare(
				getAgendaEntryTitle(right.entry),
				"de",
			);
		}
		if (left.startMinutes === null) return -1;
		if (right.startMinutes === null) return 1;
		return left.startMinutes - right.startMinutes;
	});

export const isDashboardAgendaItemPast = ({
	item,
	todayKey,
	currentMinutes,
}: {
	item: DashboardAgendaItem;
	todayKey: string;
	currentMinutes: number;
}) => {
	if (item.entry.completed) return true;
	if (item.dayKey < todayKey) return true;
	if (item.dayKey > todayKey || item.endMinutes === null) return false;
	return item.endMinutes < currentMinutes;
};

export const findNextActionableAgendaItemId = ({
	items,
	todayKey,
	currentMinutes,
}: {
	items: DashboardAgendaItem[];
	todayKey: string;
	currentMinutes: number;
}) =>
	findNextActionableAgendaItem({
		items,
		todayKey,
		currentMinutes,
	})?.entry.id;

export const findNextActionableAgendaItem = ({
	items,
	todayKey,
	currentMinutes,
}: {
	items: DashboardAgendaItem[];
	todayKey: string;
	currentMinutes: number;
}) =>
	[...items]
		.sort((left, right) => {
			if (left.dayKey !== right.dayKey) {
				return left.dayKey.localeCompare(right.dayKey);
			}
			return (left.startMinutes ?? -1) - (right.startMinutes ?? -1);
		})
		.find(
			(item) =>
				item.kind === "learningSession" &&
				!isDashboardAgendaItemPast({ item, todayKey, currentMinutes }),
		);
