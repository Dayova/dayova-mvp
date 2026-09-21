import { ROUTES } from "~/lib/routes";

export const EMPTY_DASHBOARD_PRIMARY_ACTION = {
	label: "Erste Prüfung planen",
	accessibilityHint: "Startet die Planung deiner ersten Prüfung.",
	route: ROUTES.createExam,
} as const;

const EXISTING_DASHBOARD_PRIMARY_ACTION = {
	label: "Lernplan öffnen",
	accessibilityHint: "Öffnet deine persönlichen Lernpläne.",
	route: ROUTES.learningPlans,
} as const;

export type DashboardNextStepFallbackAction =
	| typeof EMPTY_DASHBOARD_PRIMARY_ACTION
	| typeof EXISTING_DASHBOARD_PRIMARY_ACTION;

export const getDashboardNextStepFallbackAction = ({
	hasLearningPlans,
}: {
	hasLearningPlans: boolean;
}) =>
	hasLearningPlans
		? EXISTING_DASHBOARD_PRIMARY_ACTION
		: EMPTY_DASHBOARD_PRIMARY_ACTION;
