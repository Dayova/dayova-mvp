import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { throwUserFacingError } from "./errors";

const attributionSourceValidator = v.union(
	v.literal("product_only"),
	v.literal("founder_check_in"),
	v.literal("app_reminder"),
	v.literal("combination"),
	v.literal("unknown"),
);

const requireIdentity = async (ctx: QueryCtx | MutationCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (identity === null) {
		throwUserFacingError("Nicht authentifiziert.");
	}

	return identity;
};

const getCurrentUser = async (ctx: QueryCtx | MutationCtx) => {
	const identity = await requireIdentity(ctx);
	const user = await ctx.db
		.query("users")
		.withIndex("by_tokenIdentifier", (q) =>
			q.eq("tokenIdentifier", identity.tokenIdentifier),
		)
		.unique();

	if (!user) {
		throwUserFacingError("Nutzer nicht gefunden.");
	}

	return user;
};

const requireFounder = async (ctx: QueryCtx | MutationCtx) => {
	const user = await getCurrentUser(ctx);
	if (user.validationRole !== "founder") {
		throwUserFacingError("Kein Zugriff auf die Validierungsübersicht.");
	}

	return user;
};

const upsertValidationState = async (
	ctx: MutationCtx,
	user: Doc<"users">,
	localDayKey: string,
) => {
	const now = Date.now();
	const existing = await ctx.db
		.query("validationUserStates")
		.withIndex("by_ownerTokenIdentifier", (q) =>
			q.eq("ownerTokenIdentifier", user.tokenIdentifier),
		)
		.unique();

	if (existing) {
		await ctx.db.patch("validationUserStates", existing._id, {
			validationStudentCode: user.validationStudentCode,
			firstActivityDayKey: existing.firstActivityDayKey ?? localDayKey,
			lastActivityDayKey: localDayKey,
			updatedAt: now,
		});
		return existing._id;
	}

	return await ctx.db.insert("validationUserStates", {
		ownerTokenIdentifier: user.tokenIdentifier,
		userId: user._id,
		validationStudentCode: user.validationStudentCode,
		firstActivityDayKey: localDayKey,
		lastActivityDayKey: localDayKey,
		createdAt: now,
		updatedAt: now,
	});
};

export const markActivity = mutation({
	args: {
		localDayKey: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		await upsertValidationState(ctx, user, args.localDayKey);
		return {
			validationStudentCode: user.validationStudentCode ?? null,
		};
	},
});

export const markReturnedNextDay = mutation({
	args: {
		localDayKey: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		const state = await ctx.db
			.query("validationUserStates")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", user.tokenIdentifier),
			)
			.unique();

		if (
			!state?.lastActivityDayKey ||
			state.lastActivityDayKey >= args.localDayKey ||
			state.lastReturnDayKey === args.localDayKey
		) {
			return {
				captured: false,
				validationStudentCode: user.validationStudentCode ?? null,
				previousActivityDayKey: state?.lastActivityDayKey ?? null,
			};
		}

		await ctx.db.patch("validationUserStates", state._id, {
			validationStudentCode: user.validationStudentCode,
			lastReturnDayKey: args.localDayKey,
			updatedAt: Date.now(),
		});

		return {
			captured: true,
			validationStudentCode: user.validationStudentCode ?? null,
			previousActivityDayKey: state.lastActivityDayKey,
		};
	},
});

const getSessionStatus = (session: Doc<"learningPlanSessions">) =>
	session.executionStatus ?? (session.completed ? "completed" : "notStarted");

const latestAttributionForSession = async (
	ctx: QueryCtx,
	sessionId: Id<"learningPlanSessions">,
) => {
	const attributions = await ctx.db
		.query("validationAttributions")
		.withIndex("by_learningPlanSessionId", (q) =>
			q.eq("learningPlanSessionId", sessionId),
		)
		.order("desc")
		.take(1);

	return attributions[0] ?? null;
};

export const dailyOverview = query({
	args: {
		dayKey: v.string(),
	},
	handler: async (ctx, args) => {
		await requireFounder(ctx);

		const sessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_dateKey", (q) => q.eq("dateKey", args.dayKey))
			.order("asc")
			.take(200);

		const rows = [];
		for (const session of sessions) {
			const plan = await ctx.db.get("learningPlans", session.learningPlanId);
			if (!plan) continue;

			const user = await ctx.db
				.query("users")
				.withIndex("by_tokenIdentifier", (q) =>
					q.eq("tokenIdentifier", session.ownerTokenIdentifier),
				)
				.unique();
			const attribution = await latestAttributionForSession(ctx, session._id);
			const status = getSessionStatus(session);

			rows.push({
				sessionId: session._id,
				learningPlanId: session.learningPlanId,
				validationStudentCode:
					user?.validationStudentCode ?? attribution?.validationStudentCode,
				studentName: user?.name,
				subject: plan.subject,
				examTypeLabel: plan.examTypeLabel,
				examDateKey: plan.examDateKey,
				title: session.title,
				phase: session.phase,
				dateKey: session.dateKey,
				dateLabel: session.dateLabel,
				startTime: session.startTime,
				durationMinutes: session.durationMinutes,
				status,
				startedAt: session.startedAt,
				outcomeAt: session.outcomeAt,
				missedReason: session.missedReason,
				needsCheckIn:
					status === "notStarted" ||
					status === "started" ||
					status === "missed",
				attribution: attribution
					? {
							source: attribution.source,
							note: attribution.note,
							recordedAt: attribution.recordedAt,
						}
					: null,
			});
		}

		return { dayKey: args.dayKey, rows };
	},
});

export const recordAttribution = mutation({
	args: {
		sessionId: v.id("learningPlanSessions"),
		source: attributionSourceValidator,
		note: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const founder = await requireFounder(ctx);
		const session = await ctx.db.get("learningPlanSessions", args.sessionId);
		if (!session) {
			throwUserFacingError("Lernblock nicht gefunden.");
		}

		const plan = await ctx.db.get("learningPlans", session.learningPlanId);
		if (!plan) {
			throwUserFacingError("Lernplan nicht gefunden.");
		}

		const user = await ctx.db
			.query("users")
			.withIndex("by_tokenIdentifier", (q) =>
				q.eq("tokenIdentifier", session.ownerTokenIdentifier),
			)
			.unique();

		return await ctx.db.insert("validationAttributions", {
			learningPlanSessionId: session._id,
			learningPlanId: session.learningPlanId,
			ownerTokenIdentifier: session.ownerTokenIdentifier,
			validationStudentCode: user?.validationStudentCode,
			source: args.source,
			...(args.note?.trim() ? { note: args.note.trim() } : {}),
			recordedByTokenIdentifier: founder.tokenIdentifier,
			recordedAt: Date.now(),
		});
	},
});
