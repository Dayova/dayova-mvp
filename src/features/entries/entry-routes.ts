import { getDayKey, parseDayKey } from "~/lib/day-key";

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

export function resolveEntryStartParams(params: EntryParams) {
	const examResumeRequested =
		params.type === "exam" &&
		(params.step === "learningAvailability" || Boolean(params.examDayEntryId));
	if (!examResumeRequested) return { params, restoreExamHistory: false };

	const parsedDay = parseDayKey(params.dayKey);
	const restoreExamHistory = Boolean(
		params.step === "learningAvailability" &&
			params.examDayEntryId?.trim() &&
			params.subject?.trim() &&
			params.examTypeLabel?.trim() &&
			parsedDay &&
			getDayKey(parsedDay) === params.dayKey,
	);

	return restoreExamHistory
		? { params, restoreExamHistory }
		: { params: { type: "exam" }, restoreExamHistory: false };
}
