import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
	env,
	internalMutation,
	internalQuery,
	type MutationCtx,
	type QueryCtx,
	query,
} from "./_generated/server";
import { throwUserFacingError } from "./errors";
import {
	AI_BUDGET_LIMIT_MESSAGES,
	DEFAULT_LEARNING_PLAN_AI_BUDGET_LIMITS,
	evaluateLearningPlanAiBudget,
	getUtcCalendarMonthRange,
	type LearningPlanAiBudgetLimits,
} from "./learningPlanAiBudgetPolicy";

export const aiUsageOperationValidator = v.union(
	v.literal("diagnostic"),
	v.literal("plan"),
	v.literal("session_theory"),
	v.literal("session_practice"),
	v.literal("session_praxis"),
);

type AiUsageOperation =
	| "diagnostic"
	| "plan"
	| "session_theory"
	| "session_practice"
	| "session_praxis";

const RESERVATION_STALE_AFTER_MS = 20 * 60 * 1_000;
const MAX_MONTHLY_LEDGER_ENTRIES = 5_000;
const MAX_PLAN_LEDGER_ENTRIES = 1_000;

const parseBudgetLimit = (value: string | undefined, fallback: number) => {
	if (value === undefined) return fallback;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const getLearningPlanAiBudgetLimits = (): LearningPlanAiBudgetLimits => {
	const monthlyHardUsdMicros = parseBudgetLimit(
		env.LEARNING_PLAN_AI_MONTHLY_HARD_USD_MICROS,
		DEFAULT_LEARNING_PLAN_AI_BUDGET_LIMITS.monthlyHardUsdMicros,
	);
	const planHardUsdMicros = parseBudgetLimit(
		env.LEARNING_PLAN_AI_PLAN_HARD_USD_MICROS,
		DEFAULT_LEARNING_PLAN_AI_BUDGET_LIMITS.planHardUsdMicros,
	);

	return {
		monthlyHardUsdMicros,
		monthlyEconomyUsdMicros: Math.min(
			monthlyHardUsdMicros,
			parseBudgetLimit(
				env.LEARNING_PLAN_AI_MONTHLY_ECONOMY_USD_MICROS,
				DEFAULT_LEARNING_PLAN_AI_BUDGET_LIMITS.monthlyEconomyUsdMicros,
			),
		),
		monthlySpeculationUsdMicros: Math.min(
			monthlyHardUsdMicros,
			parseBudgetLimit(
				env.LEARNING_PLAN_AI_MONTHLY_SPECULATION_USD_MICROS,
				DEFAULT_LEARNING_PLAN_AI_BUDGET_LIMITS.monthlySpeculationUsdMicros,
			),
		),
		planTargetUsdMicros: Math.min(
			planHardUsdMicros,
			parseBudgetLimit(
				env.LEARNING_PLAN_AI_PLAN_TARGET_USD_MICROS,
				DEFAULT_LEARNING_PLAN_AI_BUDGET_LIMITS.planTargetUsdMicros,
			),
		),
		planHardUsdMicros,
	};
};

const requireOwnedPlan = async (
	ctx: QueryCtx | MutationCtx,
	learningPlanId: Id<"learningPlans">,
) => {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throwUserFacingError("Nicht authentifiziert.");
	const plan = await ctx.db.get("learningPlans", learningPlanId);
	if (!plan || plan.ownerTokenIdentifier !== identity.tokenIdentifier) {
		throwUserFacingError("Lernplan nicht gefunden.");
	}
	return { identity, plan };
};

const budgetCostForUsage = (entry: {
	budgetCostUsdMicros?: number;
	estimatedCostUsdMicros: number;
}) => entry.budgetCostUsdMicros ?? entry.estimatedCostUsdMicros;

const sumBudgetCost = (
	entries: Array<{
		budgetCostUsdMicros?: number;
		estimatedCostUsdMicros: number;
	}>,
) => entries.reduce((total, entry) => total + budgetCostForUsage(entry), 0);

const insertProjectedFailureUsage = async (
	ctx: MutationCtx,
	reservation: {
		ownerTokenIdentifier: string;
		learningPlanId: Id<"learningPlans">;
		sessionId?: Id<"learningPlanSessions">;
		reservationId: string;
		operation: AiUsageOperation;
		modelId: string;
		projectedCostUsdMicros: number;
		createdAt: number;
	},
) =>
	await ctx.db.insert("learningPlanAiUsage", {
		ownerTokenIdentifier: reservation.ownerTokenIdentifier,
		learningPlanId: reservation.learningPlanId,
		...(reservation.sessionId ? { sessionId: reservation.sessionId } : {}),
		reservationId: reservation.reservationId,
		operation: reservation.operation,
		modelId: reservation.modelId,
		inputTokens: 0,
		cachedInputTokens: 0,
		outputTokens: 0,
		estimatedCostUsdMicros: reservation.projectedCostUsdMicros,
		budgetCostUsdMicros: reservation.projectedCostUsdMicros,
		accountingKind: "projected_failure",
		createdAt: reservation.createdAt,
	});

const settleStaleReservations = async (
	ctx: MutationCtx,
	ownerTokenIdentifier: string,
	learningPlanId: Id<"learningPlans">,
	monthStart: number,
	now: number,
) => {
	const [monthlyReservations, planReservations] = await Promise.all([
		ctx.db
			.query("learningPlanAiBudgetReservations")
			.withIndex("by_ownerTokenIdentifier_and_monthStart", (q) =>
				q
					.eq("ownerTokenIdentifier", ownerTokenIdentifier)
					.eq("monthStart", monthStart),
			)
			.take(MAX_MONTHLY_LEDGER_ENTRIES),
		ctx.db
			.query("learningPlanAiBudgetReservations")
			.withIndex("by_learningPlanId_and_createdAt", (q) =>
				q.eq("learningPlanId", learningPlanId),
			)
			.take(MAX_PLAN_LEDGER_ENTRIES),
	]);
	const reservations = [
		...new Map(
			[...monthlyReservations, ...planReservations].map((reservation) => [
				reservation._id,
				reservation,
			]),
		).values(),
	];

	for (const reservation of reservations) {
		if (
			reservation.status !== "active" ||
			reservation.createdAt > now - RESERVATION_STALE_AFTER_MS
		) {
			continue;
		}
		await insertProjectedFailureUsage(ctx, reservation);
		await ctx.db.patch("learningPlanAiBudgetReservations", reservation._id, {
			status: "forfeited",
			updatedAt: now,
		});
	}
};

const loadBudgetInputs = async (
	ctx: QueryCtx | MutationCtx,
	args: {
		ownerTokenIdentifier: string;
		learningPlanId: Id<"learningPlans">;
		now: number;
	},
) => {
	const month = getUtcCalendarMonthRange(args.now);
	const [monthlyUsage, planUsage, monthlyReservations, planReservations] =
		await Promise.all([
			ctx.db
				.query("learningPlanAiUsage")
				.withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
					q
						.eq("ownerTokenIdentifier", args.ownerTokenIdentifier)
						.gte("createdAt", month.start)
						.lt("createdAt", month.end),
				)
				.take(MAX_MONTHLY_LEDGER_ENTRIES),
			ctx.db
				.query("learningPlanAiUsage")
				.withIndex("by_learningPlanId", (q) =>
					q.eq("learningPlanId", args.learningPlanId),
				)
				.take(MAX_PLAN_LEDGER_ENTRIES),
			ctx.db
				.query("learningPlanAiBudgetReservations")
				.withIndex("by_ownerTokenIdentifier_and_monthStart", (q) =>
					q
						.eq("ownerTokenIdentifier", args.ownerTokenIdentifier)
						.eq("monthStart", month.start),
				)
				.take(MAX_MONTHLY_LEDGER_ENTRIES),
			ctx.db
				.query("learningPlanAiBudgetReservations")
				.withIndex("by_learningPlanId_and_createdAt", (q) =>
					q.eq("learningPlanId", args.learningPlanId),
				)
				.take(MAX_PLAN_LEDGER_ENTRIES),
		]);

	return {
		monthStart: month.start,
		monthlySpentUsdMicros: sumBudgetCost(monthlyUsage),
		planSpentUsdMicros: sumBudgetCost(planUsage),
		monthlyReservedUsdMicros: monthlyReservations
			.filter((reservation) => reservation.status === "active")
			.reduce(
				(total, reservation) => total + reservation.projectedCostUsdMicros,
				0,
			),
		planReservedUsdMicros: planReservations
			.filter((reservation) => reservation.status === "active")
			.reduce(
				(total, reservation) => total + reservation.projectedCostUsdMicros,
				0,
			),
	};
};

export const getBudgetStatus = internalQuery({
	args: {
		learningPlanId: v.id("learningPlans"),
		projectedCostUsdMicros: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const { identity } = await requireOwnedPlan(ctx, args.learningPlanId);
		const budget = await loadBudgetInputs(ctx, {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId: args.learningPlanId,
			now: Date.now(),
		});
		return evaluateLearningPlanAiBudget({
			...budget,
			projectedCostUsdMicros: args.projectedCostUsdMicros ?? 0,
			limits: getLearningPlanAiBudgetLimits(),
		});
	},
});

export const getPlanGenerationPolicy = query({
	args: { learningPlanId: v.id("learningPlans") },
	handler: async (ctx, args) => {
		const { identity } = await requireOwnedPlan(ctx, args.learningPlanId);
		const budget = await loadBudgetInputs(ctx, {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId: args.learningPlanId,
			now: Date.now(),
		});
		const decision = evaluateLearningPlanAiBudget({
			...budget,
			projectedCostUsdMicros: 30_000,
			limits: getLearningPlanAiBudgetLimits(),
		});
		return {
			economyMode: decision.economyMode,
			speculativeGenerationAllowed: decision.speculativeGenerationAllowed,
			limitReached: !decision.allowed,
			blockReason: decision.blockReason,
		};
	},
});

export const reserve = internalMutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		sessionId: v.optional(v.id("learningPlanSessions")),
		reservationId: v.string(),
		operation: aiUsageOperationValidator,
		modelId: v.string(),
		projectedCostUsdMicros: v.number(),
	},
	handler: async (ctx, args) => {
		const { identity } = await requireOwnedPlan(ctx, args.learningPlanId);
		const existing = await ctx.db
			.query("learningPlanAiBudgetReservations")
			.withIndex("by_ownerTokenIdentifier_and_reservationId", (q) =>
				q
					.eq("ownerTokenIdentifier", identity.tokenIdentifier)
					.eq("reservationId", args.reservationId),
			)
			.unique();
		if (existing) return existing;

		const now = Date.now();
		const { start: monthStart } = getUtcCalendarMonthRange(now);
		await settleStaleReservations(
			ctx,
			identity.tokenIdentifier,
			args.learningPlanId,
			monthStart,
			now,
		);
		const budget = await loadBudgetInputs(ctx, {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId: args.learningPlanId,
			now,
		});
		const decision = evaluateLearningPlanAiBudget({
			...budget,
			projectedCostUsdMicros: args.projectedCostUsdMicros,
			limits: getLearningPlanAiBudgetLimits(),
		});
		if (!decision.allowed && decision.blockReason) {
			throwUserFacingError(AI_BUDGET_LIMIT_MESSAGES[decision.blockReason]);
		}

		const reservationDocument = {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId: args.learningPlanId,
			...(args.sessionId ? { sessionId: args.sessionId } : {}),
			reservationId: args.reservationId,
			operation: args.operation,
			modelId: args.modelId,
			projectedCostUsdMicros: Math.max(
				0,
				Math.floor(args.projectedCostUsdMicros),
			),
			status: "active" as const,
			monthStart,
			createdAt: now,
			updatedAt: now,
		};
		const reservationDocumentId = await ctx.db.insert(
			"learningPlanAiBudgetReservations",
			reservationDocument,
		);
		return { _id: reservationDocumentId, ...reservationDocument };
	},
});

export const settle = internalMutation({
	args: {
		reservationId: v.string(),
		inputTokens: v.number(),
		cachedInputTokens: v.number(),
		outputTokens: v.number(),
		estimatedCostUsdMicros: v.number(),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		const reservation = await ctx.db
			.query("learningPlanAiBudgetReservations")
			.withIndex("by_ownerTokenIdentifier_and_reservationId", (q) =>
				q
					.eq("ownerTokenIdentifier", identity.tokenIdentifier)
					.eq("reservationId", args.reservationId),
			)
			.unique();
		if (!reservation) throwUserFacingError("KI-Reservierung nicht gefunden.");
		const existingUsage = await ctx.db
			.query("learningPlanAiUsage")
			.withIndex("by_ownerTokenIdentifier_and_reservationId", (q) =>
				q
					.eq("ownerTokenIdentifier", identity.tokenIdentifier)
					.eq("reservationId", args.reservationId),
			)
			.unique();
		if (existingUsage) return existingUsage._id;

		const usageId = await ctx.db.insert("learningPlanAiUsage", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId: reservation.learningPlanId,
			...(reservation.sessionId ? { sessionId: reservation.sessionId } : {}),
			reservationId: reservation.reservationId,
			operation: reservation.operation,
			modelId: reservation.modelId,
			inputTokens: Math.max(0, Math.floor(args.inputTokens)),
			cachedInputTokens: Math.max(0, Math.floor(args.cachedInputTokens)),
			outputTokens: Math.max(0, Math.floor(args.outputTokens)),
			estimatedCostUsdMicros: Math.max(
				0,
				Math.floor(args.estimatedCostUsdMicros),
			),
			budgetCostUsdMicros: Math.max(0, Math.floor(args.estimatedCostUsdMicros)),
			accountingKind: "measured",
			createdAt: reservation.createdAt,
		});
		await ctx.db.patch("learningPlanAiBudgetReservations", reservation._id, {
			status: "settled",
			updatedAt: Date.now(),
		});
		return usageId;
	},
});

export const forfeit = internalMutation({
	args: { reservationId: v.string() },
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		const reservation = await ctx.db
			.query("learningPlanAiBudgetReservations")
			.withIndex("by_ownerTokenIdentifier_and_reservationId", (q) =>
				q
					.eq("ownerTokenIdentifier", identity.tokenIdentifier)
					.eq("reservationId", args.reservationId),
			)
			.unique();
		if (!reservation) throwUserFacingError("KI-Reservierung nicht gefunden.");
		const existingUsage = await ctx.db
			.query("learningPlanAiUsage")
			.withIndex("by_ownerTokenIdentifier_and_reservationId", (q) =>
				q
					.eq("ownerTokenIdentifier", identity.tokenIdentifier)
					.eq("reservationId", args.reservationId),
			)
			.unique();
		if (existingUsage) return existingUsage._id;

		const usageId = await insertProjectedFailureUsage(ctx, reservation);
		await ctx.db.patch("learningPlanAiBudgetReservations", reservation._id, {
			status: "forfeited",
			updatedAt: Date.now(),
		});
		return usageId;
	},
});

export const getPlanCostSummary = query({
	args: { learningPlanId: v.id("learningPlans") },
	handler: async (ctx, args) => {
		await requireOwnedPlan(ctx, args.learningPlanId);
		const entries = await ctx.db
			.query("learningPlanAiUsage")
			.withIndex("by_learningPlanId", (q) =>
				q.eq("learningPlanId", args.learningPlanId),
			)
			.take(MAX_PLAN_LEDGER_ENTRIES);

		return entries.reduce(
			(summary, entry) => ({
				requestCount: summary.requestCount + 1,
				inputTokens: summary.inputTokens + entry.inputTokens,
				cachedInputTokens: summary.cachedInputTokens + entry.cachedInputTokens,
				outputTokens: summary.outputTokens + entry.outputTokens,
				estimatedCostUsdMicros:
					summary.estimatedCostUsdMicros + entry.estimatedCostUsdMicros,
				budgetCostUsdMicros:
					summary.budgetCostUsdMicros + budgetCostForUsage(entry),
			}),
			{
				requestCount: 0,
				inputTokens: 0,
				cachedInputTokens: 0,
				outputTokens: 0,
				estimatedCostUsdMicros: 0,
				budgetCostUsdMicros: 0,
			},
		);
	},
});

export const getMyMonthlyCostSummary = query({
	args: { monthStart: v.number() },
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		const month = getUtcCalendarMonthRange(args.monthStart);
		const entries = await ctx.db
			.query("learningPlanAiUsage")
			.withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
				q
					.eq("ownerTokenIdentifier", identity.tokenIdentifier)
					.gte("createdAt", month.start)
					.lt("createdAt", month.end),
			)
			.take(MAX_MONTHLY_LEDGER_ENTRIES);

		return {
			planCount: new Set(entries.map((entry) => entry.learningPlanId)).size,
			requestCount: entries.length,
			estimatedCostUsdMicros: entries.reduce(
				(total, entry) => total + entry.estimatedCostUsdMicros,
				0,
			),
			budgetCostUsdMicros: sumBudgetCost(entries),
		};
	},
});
