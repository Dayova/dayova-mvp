import {
	getLearningPlanGenerationFailureReason,
	type LearningPlanGenerationFailureReason,
} from "#convex/learningPlanGenerationFailure";
import {
	extractUserFacingErrorCode,
	extractUserFacingErrorMessage,
} from "~/lib/user-facing-errors";

export type { LearningPlanGenerationFailureReason } from "#convex/learningPlanGenerationFailure";

export type LearningPlanGenerationFailure = {
	reason: LearningPlanGenerationFailureReason;
	message: string;
	canReviewTopics: boolean;
	canEditMaterial: boolean;
	canEditLearningTimes: boolean;
	canStartNewPlan?: boolean;
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
	persistedMessage?: string,
): LearningPlanGenerationFailure => {
	const code = extractUserFacingErrorCode(error);
	const sourceMessage =
		extractUserFacingErrorMessage(error) ?? persistedMessage;
	if (code === "legacy_plan_too_large")
		return {
			reason: "generationProcessing",
			message:
				"Dieser Lernplan enthält zu viele Lerneinheiten. Erstelle einen neuen Lernplan.",
			canReviewTopics: false,
			canEditMaterial: false,
			canEditLearningTimes: false,
			canStartNewPlan: true,
		};
	const reason =
		persistedReason ?? getLearningPlanGenerationFailureReason(code);

	return {
		reason,
		message:
			(reason === "insufficientMaterial" ||
				reason === "materialProcessing" ||
				reason === "schedulingConstraints") &&
			sourceMessage?.trim()
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
