export type EntryStep = "examType" | "examDetails" | "basics" | "planning";

export type EntryParams = {
	type?: string;
	dayKey?: string;
	step?: string;
	subject?: string;
	personalSubjectId?: string;
	dayLabel?: string;
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
		case "planning":
			return "/entry/new/planning" as const;
	}
}

export const EXAM_RESUME_ROUTES = ["index", "subject", "date"] as const;
