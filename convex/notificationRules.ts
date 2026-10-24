type LearningReminderEntry = {
	title?: unknown;
	kind?: string;
	durationMinutes?: number;
	completed?: boolean;
	executionStatus?: string;
	relatedLearningPlanId?: string;
	relatedLearningPlanSessionId?: string;
};

export const isLearningReminderEntry = (entry: LearningReminderEntry) =>
	entry.kind === "Lernen" ||
	Boolean(entry.relatedLearningPlanId || entry.relatedLearningPlanSessionId);

export const isReminderEntryPending = (entry: LearningReminderEntry) =>
	entry.completed !== true &&
	(!isLearningReminderEntry(entry) ||
		!entry.executionStatus ||
		entry.executionStatus === "notStarted");

export const learningReminderBody = (
	entry: LearningReminderEntry,
	type: "beforeEvent" | "startEvent" | "forgottenEvent",
	offset = 15,
) => {
	const title =
		typeof entry.title === "string" && entry.title.trim()
			? entry.title.trim()
			: "Deine Lernsession";
	if (type === "beforeEvent")
		return `In ${offset} Minuten: ${title}${entry.durationMinutes ? ` · ${entry.durationMinutes} Minuten` : ""}.`;
	if (type === "startEvent")
		return entry.durationMinutes
			? `${title}: ${entry.durationMinutes} Minuten stehen jetzt an. Starte deine Lernsession.`
			: `${title} steht jetzt an. Starte deine Lernsession.`;
	return `Heute nicht geschafft? Finde einen neuen Termin für ${title}.`;
};
