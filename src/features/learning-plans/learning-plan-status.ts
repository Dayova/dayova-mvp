import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { parseDayKey } from "~/lib/day-key";

export type LearningPlanStatusInput = {
	completedCount?: number;
	sessionCount?: number;
	rollingPlanEnabled?: boolean;
	masteryStatus?: "learning" | "mastered";
	currentSession?: { dateKey: string } | null;
};

const differenceInCalendarDays = (laterKey: string, earlierKey: string) => {
	const later = parseDayKey(laterKey);
	const earlier = parseDayKey(earlierKey);
	if (!later || !earlier) return null;
	return Math.ceil((later.getTime() - earlier.getTime()) / 86_400_000);
};

export const getLearningPlanStatus = (
	plan: LearningPlanStatusInput,
	todayKey: string,
): { label: string; background: string; foreground: string } => {
	const sessionCount = plan.sessionCount ?? 0;
	const completedCount = plan.completedCount ?? 0;
	const isFinished = plan.rollingPlanEnabled
		? plan.masteryStatus === "mastered"
		: sessionCount > 0 && completedCount >= sessionCount;
	if (isFinished) {
		return {
			label: "Fertig",
			background: DAYOVA_DESIGN_SYSTEM.colors.successSubtle,
			foreground: DAYOVA_DESIGN_SYSTEM.colors.success,
		};
	}
	if (
		plan.rollingPlanEnabled &&
		plan.masteryStatus === "learning" &&
		sessionCount > 0 &&
		completedCount >= sessionCount
	) {
		return {
			label: "Wiederholen",
			background: DAYOVA_DESIGN_SYSTEM.colors.systemSubtle,
			foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
		};
	}

	const sessionKey = plan.currentSession?.dateKey;
	const daysUntilSession = sessionKey
		? differenceInCalendarDays(sessionKey, todayKey)
		: null;
	if (daysUntilSession !== null && daysUntilSession < 0) {
		return {
			label: "Fällig",
			background: DAYOVA_DESIGN_SYSTEM.colors.wrongSubtle,
			foreground: DAYOVA_DESIGN_SYSTEM.colors.wrong,
		};
	}
	if (daysUntilSession === 0) {
		return {
			label: "Heute",
			background: DAYOVA_DESIGN_SYSTEM.colors.systemSubtle,
			foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
		};
	}
	if (daysUntilSession === 1) {
		return {
			label: "Morgen",
			background: DAYOVA_DESIGN_SYSTEM.colors.systemSubtle,
			foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
		};
	}
	return {
		label: "Geplant",
		background: DAYOVA_DESIGN_SYSTEM.colors.systemSubtle,
		foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
	};
};
