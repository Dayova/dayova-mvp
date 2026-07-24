const DEFAULT_STUDY_TIME_MINUTES = 30;

const getStudyTimeMinutes = (value: string) => {
	const minutes = Number.parseInt(value, 10);
	return Number.isFinite(minutes) && minutes > 0
		? minutes
		: DEFAULT_STUDY_TIME_MINUTES;
};

export const getStudyTimeFactBody = (studyTime: string) =>
	`Deine ${getStudyTimeMinutes(studyTime)} Minuten reichen aus, um eine starke Lernroutine aufzubauen. Studien zeigen: Kleine Lerneinheiten bleiben länger hängen als langes Pauken auf einmal.`;
