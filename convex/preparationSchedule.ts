import type {
	LearningTimeWindow,
	OccupiedLearningTime,
} from "./learningPlanAvailability";
import { preparationBudget } from "./learningPreparationPolicy";
export type PreparationSlot = {
	id: string;
	dateKey: string;
	startTime: string;
	durationMinutes: number;
};
export const timeMinutes = (value: string) => {
	if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
	const [hours, minutes] = value.split(":").map(Number);
	return hours * 60 + minutes;
};
export const timeLabel = (minutes: number) =>
	`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export function berlinNow(now = new Date()) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Berlin",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(now);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value ?? "";
	return {
		dateKey: `${part("year")}-${part("month")}-${part("day")}`,
		minutes: Number(part("hour")) * 60 + Number(part("minute")),
	};
}
export const slotDateLabel = (key: string) =>
	new Intl.DateTimeFormat("de-DE", {
		weekday: "short",
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "Europe/Berlin",
	}).format(new Date(`${key.slice(0, 10)}T12:00:00Z`));
export function validatePreparationSlots(
	slots: PreparationSlot[],
	examDateKey: string,
) {
	if (!slots.length || slots.length > 180)
		return "Plane mindestens einen Termin ein (höchstens 180).";
	const ids = new Set<string>();
	let total = 0;
	for (const slot of slots) {
		const date = new Date(`${slot.dateKey}T12:00:00Z`);
		const start = timeMinutes(slot.startTime);
		if (
			!/^\d{4}-\d{2}-\d{2}$/.test(slot.dateKey) ||
			!Number.isFinite(date.getTime()) ||
			date.toISOString().slice(0, 10) !== slot.dateKey ||
			slot.dateKey >= examDateKey.slice(0, 10)
		)
			return "Wähle gültige Lerntage vor deiner Prüfung.";
		if (!slot.id || slot.id.length > 100 || ids.has(slot.id))
			return "Die Termine müssen eindeutig sein.";
		ids.add(slot.id);
		if (
			start === null ||
			!Number.isInteger(slot.durationMinutes) ||
			slot.durationMinutes < 5 ||
			slot.durationMinutes > 240 ||
			slot.durationMinutes % 5 !== 0 ||
			start + slot.durationMinutes > 1440
		)
			return "Wähle 5 bis 240 Minuten innerhalb eines Tages, in Schritten von 5 Minuten.";
		total += slot.durationMinutes;
	}
	if (total > 3600) return "Plane höchstens 60 Stunden in diesem Lernplan ein.";
	const sorted = [...slots].sort(
		(a, b) =>
			a.dateKey.localeCompare(b.dateKey) ||
			a.startTime.localeCompare(b.startTime),
	);
	for (let i = 1; i < sorted.length; i++) {
		const previous = sorted[i - 1];
		const current = sorted[i];
		if (
			previous.dateKey === current.dateKey &&
			(timeMinutes(previous.startTime) ?? 0) + previous.durationMinutes >
				(timeMinutes(current.startTime) ?? 0)
		)
			return "Zwei deiner Lerntermine überschneiden sich.";
	}
	return null;
}
/** Preferred days first; extra days reuse the preferred clock time. Spread across the horizon. */
export function proposePreparationSchedule(args: {
	examTypeLabel: string;
	examDateKey: string;
	now: { dateKey: string; minutes: number };
	learningTimes: LearningTimeWindow[];
	occupiedEntries: OccupiedLearningTime[];
}) {
	const policy = preparationBudget(args.examTypeLabel);
	const exam = new Date(`${args.examDateKey.slice(0, 10)}T12:00:00Z`);
	const today = new Date(`${args.now.dateKey}T12:00:00Z`);
	if (!Number.isFinite(exam.getTime()) || !Number.isFinite(today.getTime()))
		return [];
	const days = Math.ceil((exam.getTime() - today.getTime()) / 86400000);
	if (days <= 0 || days > 366) return [];
	const startOffset = Math.max(0, days - policy.horizonDays);
	const times = args.learningTimes.length
		? args.learningTimes
		: [{ dayOfWeek: 1, startTime: "17:00", endTime: "17:30" }];
	const preferred = [...times].sort((a, b) =>
		a.startTime.localeCompare(b.startTime),
	)[0];
	const commonStart = timeMinutes(preferred.startTime) ?? 1020;
	const commonDuration = Math.max(
		10,
		Math.min(
			60,
			(timeMinutes(preferred.endTime) ?? commonStart + 30) - commonStart,
		),
	);
	const candidates: Array<PreparationSlot & { preferred: boolean }> = [];
	for (let day = startOffset; day < days; day++) {
		const date = new Date(today);
		date.setUTCDate(date.getUTCDate() + day);
		const dateKey = date.toISOString().slice(0, 10);
		const windows = times.filter(
			(t) => t.dayOfWeek === (date.getUTCDay() || 7),
		);
		const preferredDay = windows.length > 0;
		for (const window of windows.length
			? windows
			: [
					{
						startTime: timeLabel(commonStart),
						endTime: timeLabel(Math.min(1439, commonStart + commonDuration)),
					},
				]) {
			const start = timeMinutes(window.startTime);
			const end =
				window.endTime === "24:00" ? 1440 : timeMinutes(window.endTime);
			if (start === null || end === null) continue;
			let cursor =
				dateKey === args.now.dateKey
					? Math.max(start, Math.ceil((args.now.minutes + 1) / 5) * 5)
					: start;
			const limit = Math.min(end, 1440);
			const occupied = args.occupiedEntries
				.filter((e) => e.dayKey.slice(0, 10) === dateKey)
				.flatMap((e) => {
					const at = e.time ? timeMinutes(e.time) : null;
					return at === null || !e.durationMinutes
						? []
						: [{ start: at, end: at + e.durationMinutes }];
				})
				.sort((a, b) => a.start - b.start);
			while (cursor + 10 <= limit) {
				const collision = occupied.find(
					(o) => o.start < cursor + 10 && o.end > cursor,
				);
				if (collision) {
					cursor = Math.ceil(collision.end / 5) * 5;
					continue;
				}
				const next = occupied.find((o) => o.start > cursor)?.start ?? limit;
				const duration =
					Math.floor(
						Math.min(limit - cursor, next - cursor, commonDuration) / 5,
					) * 5;
				if (duration >= 10)
					candidates.push({
						id: `${dateKey}-${timeLabel(cursor)}`,
						dateKey,
						startTime: timeLabel(cursor),
						durationMinutes: duration,
						preferred: preferredDay,
					});
				cursor += Math.max(5, duration);
			}
		}
	}
	const result: PreparationSlot[] = [];
	let remaining = policy.minutes;
	for (const preferredDay of [true, false]) {
		const pool = candidates.filter((c) => c.preferred === preferredDay);
		const total = pool.reduce((sum, c) => sum + c.durationMinutes, 0);
		const desired = Math.min(remaining, total);
		let accumulated = 0;
		let used = 0;
		// Proportional selection keeps an early start and distributes study across weeks.
		for (const candidate of pool) {
			if (remaining <= 0) break;
			const threshold = total > 0 ? (accumulated / total) * desired : 0;
			if (used <= threshold + 0.001) {
				const duration = Math.min(candidate.durationMinutes, remaining);
				result.push({
					id: candidate.id,
					dateKey: candidate.dateKey,
					startTime: candidate.startTime,
					durationMinutes: duration,
				});
				remaining -= duration;
				used += duration;
			}
			accumulated += candidate.durationMinutes;
		}
	}
	return result.sort(
		(a, b) =>
			a.dateKey.localeCompare(b.dateKey) ||
			a.startTime.localeCompare(b.startTime),
	);
}
export function splitPreparationSlot(slot: PreparationSlot) {
	const steps: Array<{ startTime: string; durationMinutes: number }> = [];
	let offset = 0;
	while (offset < slot.durationMinutes) {
		const duration = Math.min(10, slot.durationMinutes - offset);
		steps.push({
			startTime: timeLabel((timeMinutes(slot.startTime) ?? 0) + offset),
			durationMinutes: duration,
		});
		offset += duration;
	}
	return steps;
}
