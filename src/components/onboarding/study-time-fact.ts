const DEFAULT_STUDY_TIME_MINUTES = 30;

const getStudyTimeMinutes = (value: string) => {
	const minutes = Number.parseInt(value, 10);
	return Number.isFinite(minutes) && minutes > 0
		? minutes
		: DEFAULT_STUDY_TIME_MINUTES;
};

export const getStudyTimeFactBody = (studyTime: string) =>
	`Wir verwenden ${getStudyTimeMinutes(studyTime)} Minuten als Dauer deiner ersten Lernzeiten. Als Nächstes wählst du die passenden Tage und deine Startzeit.`;
