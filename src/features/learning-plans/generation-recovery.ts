import {
	extractUserFacingErrorCode,
	extractUserFacingErrorMessage,
} from "~/lib/user-facing-errors";

export type LearningPlanGenerationFailureReason =
	| "insufficientMaterial"
	| "materialProcessing"
	| "schedulingConstraints"
	| "generationProcessing";

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
};

const inferReasonFromMessage = (
	message: string | null,
): LearningPlanGenerationFailureReason => {
	const normalized = message?.toLocaleLowerCase("de-DE") ?? "";
	if (
		normalized.includes("lernzeit") ||
		normalized.includes("lerntage") ||
		normalized.includes("prüfungstermin") ||
		normalized.includes("bereits belegt")
	) {
		return "schedulingConstraints";
	}
	if (
		normalized.includes("zu groß") ||
		normalized.includes("nicht gelesen") ||
		normalized.includes("verarbeitet")
	) {
		return "materialProcessing";
	}
	if (
		normalized.includes("unterlagen") ||
		normalized.includes("prüfungsstoff") ||
		normalized.includes("schulmaterial")
	) {
		return "insufficientMaterial";
	}
	return "generationProcessing";
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
		inferReasonFromMessage(sourceMessage);

	return {
		reason,
		message: messageByReason[reason],
		canReviewTopics: reason === "insufficientMaterial",
		canEditMaterial:
			reason === "insufficientMaterial" || reason === "materialProcessing",
		canEditLearningTimes: reason === "schedulingConstraints",
	};
};
