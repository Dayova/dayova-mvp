import { getDayKey, parseDayKey } from "~/lib/day-key";
import {
	MAX_EXAM_DURATION_MINUTES,
	MIN_EXAM_DURATION_MINUTES,
} from "~/lib/entry-time";

export const ENTRY_AVAILABILITY_PATH = "/entry/new/availability";

export type EntryStep =
	| "examType"
	| "examDetails"
	| "basics"
	| "learningAvailability"
	| "planning";

export type EntryParams = {
	type?: string;
	dayKey?: string;
	step?: string;
	subject?: string;
	examTypeLabel?: string;
	examDayEntryId?: string;
	durationMinutes?: string;
	topicDescription?: string;
};

export type EntrySearchParams = {
	[key in keyof EntryParams]?: string | string[];
};

function singleValue(value: string | string[] | undefined) {
	return typeof value === "string" ? value : undefined;
}

export function entryStepPath(step: EntryStep, isHomework: boolean) {
	switch (step) {
		case "examType":
			return "/entry/new" as const;
		case "examDetails":
			return "/entry/new/subject" as const;
		case "basics":
			return isHomework
				? ("/entry/new" as const)
				: ("/entry/new/date" as const);
		case "learningAvailability":
			return ENTRY_AVAILABILITY_PATH;
		case "planning":
			return "/entry/new/planning" as const;
	}
}

export const EXAM_RESUME_ROUTES = [
	"index",
	"subject",
	"date",
	"availability",
] as const;

export function resolveEntryStartParams(searchParams: EntrySearchParams) {
	if (Array.isArray(searchParams.type)) {
		return {
			params: {
				type: searchParams.type.includes("exam") ? "exam" : "homework",
			},
			restoreExamHistory: false,
		};
	}

	const params: EntryParams = {
		type: singleValue(searchParams.type),
		dayKey: singleValue(searchParams.dayKey),
		step: singleValue(searchParams.step),
		subject: singleValue(searchParams.subject),
		examTypeLabel: singleValue(searchParams.examTypeLabel),
		examDayEntryId: singleValue(searchParams.examDayEntryId),
		durationMinutes: singleValue(searchParams.durationMinutes),
		topicDescription: singleValue(searchParams.topicDescription),
	};
	const examResumeRequested =
		params.type === "exam" &&
		(params.step === "learningAvailability" ||
			Boolean(searchParams.examDayEntryId));
	if (!examResumeRequested) return { params, restoreExamHistory: false };
	if (Object.values(searchParams).some(Array.isArray)) {
		return { params: { type: "exam" }, restoreExamHistory: false };
	}

	const parsedDay = parseDayKey(params.dayKey);
	const durationMinutes = Number(params.durationMinutes);
	const restoreExamHistory = Boolean(
		params.step === "learningAvailability" &&
			params.examDayEntryId?.trim() &&
			params.subject?.trim() &&
			params.examTypeLabel?.trim() &&
			parsedDay &&
			getDayKey(parsedDay) === params.dayKey &&
			Number.isInteger(durationMinutes) &&
			durationMinutes >= MIN_EXAM_DURATION_MINUTES &&
			durationMinutes <= MAX_EXAM_DURATION_MINUTES,
	);

	return restoreExamHistory
		? { params, restoreExamHistory }
		: { params: { type: "exam" }, restoreExamHistory: false };
}
