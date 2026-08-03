export const DEFAULT_LEARNING_PLAN_AI_BUDGET_LIMITS = {
	monthlyHardUsdMicros: 3_000_000,
	monthlyEconomyUsdMicros: 2_400_000,
	monthlySpeculationUsdMicros: 2_850_000,
	planTargetUsdMicros: 100_000,
	planHardUsdMicros: 150_000,
} as const;

export type LearningPlanAiBudgetLimits = {
	monthlyHardUsdMicros: number;
	monthlyEconomyUsdMicros: number;
	monthlySpeculationUsdMicros: number;
	planTargetUsdMicros: number;
	planHardUsdMicros: number;
};

export type LearningPlanAiBudgetBlockReason = "monthly" | "plan";

export type LearningPlanAiBudgetDecision = {
	allowed: boolean;
	blockReason: LearningPlanAiBudgetBlockReason | null;
	economyMode: boolean;
	speculativeGenerationAllowed: boolean;
	monthlyCommittedUsdMicros: number;
	planCommittedUsdMicros: number;
};

const finiteNonNegativeInteger = (value: number) =>
	Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const getUtcCalendarMonthRange = (timestamp: number) => {
	const date = new Date(timestamp);
	const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
	const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
	return { start, end };
};

export const evaluateLearningPlanAiBudget = (args: {
	monthlySpentUsdMicros: number;
	monthlyReservedUsdMicros: number;
	planSpentUsdMicros: number;
	planReservedUsdMicros: number;
	projectedCostUsdMicros: number;
	limits?: LearningPlanAiBudgetLimits;
}): LearningPlanAiBudgetDecision => {
	const limits = args.limits ?? DEFAULT_LEARNING_PLAN_AI_BUDGET_LIMITS;
	const projectedCostUsdMicros = finiteNonNegativeInteger(
		args.projectedCostUsdMicros,
	);
	const monthlyCommittedUsdMicros =
		finiteNonNegativeInteger(args.monthlySpentUsdMicros) +
		finiteNonNegativeInteger(args.monthlyReservedUsdMicros) +
		projectedCostUsdMicros;
	const planCommittedUsdMicros =
		finiteNonNegativeInteger(args.planSpentUsdMicros) +
		finiteNonNegativeInteger(args.planReservedUsdMicros) +
		projectedCostUsdMicros;
	const blockReason =
		monthlyCommittedUsdMicros > limits.monthlyHardUsdMicros
			? "monthly"
			: planCommittedUsdMicros > limits.planHardUsdMicros
				? "plan"
				: null;

	return {
		allowed: blockReason === null,
		blockReason,
		economyMode:
			monthlyCommittedUsdMicros >= limits.monthlyEconomyUsdMicros ||
			planCommittedUsdMicros >= limits.planTargetUsdMicros,
		speculativeGenerationAllowed:
			blockReason === null &&
			monthlyCommittedUsdMicros <= limits.monthlySpeculationUsdMicros &&
			planCommittedUsdMicros <= limits.planTargetUsdMicros,
		monthlyCommittedUsdMicros,
		planCommittedUsdMicros,
	};
};

export const AI_BUDGET_LIMIT_MESSAGES = {
	monthly:
		"Dein monatliches KI-Budget ist erreicht. Bereits vorbereitete Inhalte bleiben verfügbar.",
	plan: "Dieser Lernplan hat sein KI-Budget erreicht. Bereits vorbereitete Inhalte bleiben verfügbar.",
} as const;
