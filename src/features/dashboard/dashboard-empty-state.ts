import { ROUTES } from "~/lib/routes";

export const EMPTY_DASHBOARD_PRIMARY_ACTION = {
	label: "Erste Prüfung planen",
	accessibilityHint: "Startet die Planung deiner ersten Prüfung.",
	route: ROUTES.createExam,
} as const;
