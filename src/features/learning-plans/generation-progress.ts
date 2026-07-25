export type ContentGenerationProgress = {
	stage: "content" | "validating" | "ready" | "failed";
	totalSessionCount: number;
	readySessionCount: number;
	failedSessionCount: number;
};

export type GenerationProgressPresentation = {
	label: string;
	progress: number;
	canRetryFailedSessions: boolean;
};

export const getGenerationProgressPresentation = (
	generation: ContentGenerationProgress | undefined,
): GenerationProgressPresentation => {
	if (!generation) {
		return {
			label: "Dein Lernplan wird strukturiert",
			progress: 0.05,
			canRetryFailedSessions: false,
		};
	}

	const total = Math.max(1, generation.totalSessionCount);
	const progress = Math.min(1, generation.readySessionCount / total);

	if (generation.stage === "ready") {
		return {
			label: "Alle Lernsessionen sind bereit",
			progress: 1,
			canRetryFailedSessions: false,
		};
	}

	if (generation.stage === "failed") {
		return {
			label:
				generation.totalSessionCount === 0
					? "Der Lernplan konnte noch nicht erstellt werden"
					: `${generation.failedSessionCount} Lernsessionen konnten noch nicht erstellt werden`,
			progress,
			canRetryFailedSessions: true,
		};
	}

	if (generation.stage === "validating") {
		return {
			label: "Alle Lernsessionen werden abschließend geprüft",
			progress: Math.max(progress, 0.95),
			canRetryFailedSessions: false,
		};
	}

	return {
		label: `Fragen und Aufgaben für ${generation.readySessionCount} von ${generation.totalSessionCount} Lernsessionen erstellt`,
		progress,
		canRetryFailedSessions: false,
	};
};
