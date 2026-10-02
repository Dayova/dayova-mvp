import {
	formatOnboardingDuration,
	parseOnboardingDurationMinutes,
} from "./onboarding-learning-times";

export const getStudyTimeFactBody = (studyTime: string) => {
	const minutes = parseOnboardingDurationMinutes(studyTime);
	if (minutes === null)
		return "Wähle die Lernzeit, die in deinen Alltag passt. Du kannst sie später jederzeit anpassen.";
	if (minutes >= 120)
		return `${formatOnboardingDuration(minutes)} an deinen Lerntagen: Du möchtest dir viel Zeit zum Lernen nehmen. Plane dabei auch Pausen ein – du musst nicht die ganze Zeit am Stück lernen.`;
	if (minutes <= 15)
		return `Auch ${formatOnboardingDuration(minutes)} sind ein guter Anfang. Nimm dir etwas Überschaubares vor und mach Schritt für Schritt weiter.`;
	return `${formatOnboardingDuration(minutes)} an deinen Lerntagen ${minutes === 60 ? "ist" : "sind"} ein guter Anfang. Du musst nicht alles auf einmal schaffen – du gibst dem Lernen einen festen Platz in deinem Alltag.`;
};
