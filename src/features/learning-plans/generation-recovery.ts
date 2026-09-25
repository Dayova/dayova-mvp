import {
	extractUserFacingErrorCode,
	extractUserFacingErrorMessage,
} from "~/lib/user-facing-errors";

export type LearningPlanGenerationFailureReason =
	| "insufficientMaterial"
	| "materialProcessing"
	| "schedulingConstraints"
	| "generationProcessing"
	| "unknown";

export type LearningPlanGenerationFailure = {
	reason: LearningPlanGenerationFailureReason;
	message: string;
	canReviewTopics: boolean;
	canEditMaterial: boolean;
	canEditLearningTimes: boolean;
};

const errorCodeToReason: Record<string, LearningPlanGenerationFailureReason> = {
	insufficient_material: "insufficientMaterial",
	material_processing: "materialProcessing",
	scheduling_constraints: "schedulingConstraints",
	generation_processing: "generationProcessing",
	unknown: "unknown",
};

const messageByReason: Record<LearningPlanGenerationFailureReason, string> = {
	insufficientMaterial:
		"Aus deinen Unterlagen konnten wir noch keinen verlässlichen Prüfungsstoff erkennen. Prüfe die Themen und ergänze oder ersetze Material.",
	materialProcessing:
		"Mindestens eine Unterlage konnte technisch nicht verarbeitet werden. Ersetze die betroffene Datei oder versuche es erneut.",
	schedulingConstraints:
		"Für den Wissenscheck und den nächsten Lernschritt fehlen passende freie Lernzeiten. Passe deine Lernzeiten an und versuche es erneut.",
	generationProcessing:
		"Der Lernplan konnte technisch noch nicht vollständig erstellt werden. Deine Angaben bleiben gespeichert; du kannst es sicher erneut versuchen.",
	unknown:
		"Die Ursache konnte nicht sicher erkannt werden. Deine Angaben bleiben gespeichert; du kannst es erneut versuchen oder dein Material prüfen.",
};

export const getLearningPlanGenerationFailure = (
	error: unknown,
	persistedReason?: LearningPlanGenerationFailureReason,
): LearningPlanGenerationFailure => {
	const code = extractUserFacingErrorCode(error);
	const sourceMessage = extractUserFacingErrorMessage(error);
	const reason =
		persistedReason ??
		(code ? errorCodeToReason[code] : undefined) ??
		"unknown";

	return {
		reason,
		message:
			reason === "insufficientMaterial" && sourceMessage
				? sourceMessage
				: messageByReason[reason],
		canReviewTopics: reason === "insufficientMaterial",
		canEditMaterial:
			reason === "insufficientMaterial" ||
			reason === "materialProcessing" ||
			reason === "unknown",
		canEditLearningTimes: reason === "schedulingConstraints",
	};
};
