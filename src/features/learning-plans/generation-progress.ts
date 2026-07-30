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
			label: "Dein Lernweg wird strukturiert",
			progress: 0.05,
			canRetryFailedSessions: false,
		};
	}

	const total = Math.max(1, generation.totalSessionCount);
	const progress = Math.min(1, generation.readySessionCount / total);

	if (generation.stage === "ready") {
		return {
			label: "Dein nächster Lernschritt ist bereit",
			progress: 1,
			canRetryFailedSessions: false,
		};
	}

	if (generation.stage === "failed") {
		return {
			label:
				generation.totalSessionCount === 0
					? "Dein nächster Lernschritt konnte noch nicht erstellt werden"
					: "Dein nächster Lernschritt konnte noch nicht vorbereitet werden",
			progress,
			canRetryFailedSessions: true,
		};
	}

	if (generation.stage === "validating") {
		return {
			label: "Dein nächster Lernschritt wird abschließend geprüft",
			progress: Math.max(progress, 0.95),
			canRetryFailedSessions: false,
		};
	}

	return {
		label:
			generation.readySessionCount > 0
				? "Dein nächster Lernschritt wird geprüft"
				: "Passende Fragen und Aufgaben werden vorbereitet",
		progress,
		canRetryFailedSessions: false,
	};
};
