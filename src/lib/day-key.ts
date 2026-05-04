import { useEffect, useState } from "react";

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const padDatePart = (value: number) => value.toString().padStart(2, "0");

export const startOfLocalDay = (date: Date) => {
	const next = new Date(date);
	next.setHours(0, 0, 0, 0);
	return next;
};

export const addDays = (date: Date, days: number) => {
	const next = new Date(date);
	next.setDate(date.getDate() + days);
	next.setHours(0, 0, 0, 0);
	return next;
};

export const getDayKey = (date: Date) => {
	const localDate = startOfLocalDay(date);
	return [
		localDate.getFullYear(),
		padDatePart(localDate.getMonth() + 1),
		padDatePart(localDate.getDate()),
	].join("-");
};

export const parseDayKey = (dayKey?: string) => {
	if (!dayKey) return null;

	const dayKeyMatch = DAY_KEY_PATTERN.exec(dayKey);
	if (dayKeyMatch) {
		const year = Number(dayKeyMatch[1]);
		const monthIndex = Number(dayKeyMatch[2]) - 1;
		const day = Number(dayKeyMatch[3]);
		const parsed = new Date(year, monthIndex, day);

		if (
			parsed.getFullYear() !== year ||
			parsed.getMonth() !== monthIndex ||
			parsed.getDate() !== day
		) {
			return null;
		}

		return startOfLocalDay(parsed);
	}

	const parsed = new Date(dayKey);
	if (Number.isNaN(parsed.getTime())) return null;
	return startOfLocalDay(parsed);
};

const getCurrentLocalDay = () => startOfLocalDay(new Date());

const getMsUntilNextLocalDay = () => {
	const now = new Date();
	const nextDay = startOfLocalDay(now);
	nextDay.setDate(nextDay.getDate() + 1);
	return nextDay.getTime() - now.getTime();
};

export const useCurrentLocalDay = () => {
	const [today, setToday] = useState(getCurrentLocalDay);

	useEffect(() => {
		let timeoutId: ReturnType<typeof setTimeout>;

		const scheduleNextTick = () => {
			timeoutId = setTimeout(() => {
				setToday((currentToday) => {
					const nextToday = getCurrentLocalDay();
					return getDayKey(currentToday) === getDayKey(nextToday)
						? currentToday
						: nextToday;
				});
				scheduleNextTick();
			}, getMsUntilNextLocalDay() + 1000);
		};

		scheduleNextTick();

		return () => clearTimeout(timeoutId);
	}, []);

	return today;
};
