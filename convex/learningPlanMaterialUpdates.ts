import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { throwUserFacingError } from "./errors";
import { generatedSessionContentItemValidator } from "./learningSessionContent";
import { learningTopicValidator } from "./learningTopicMap";

const MAX_SESSIONS = 50;
const UPDATE_TIMEOUT_MS = 11 * 60_000;

export const canUpdateMaterialContent = (
	session: Doc<"learningPlanSessions">,
) =>
	!session.completed &&
	session.startedAt === undefined &&
	session.outcomeAt === undefined &&
	(session.executionStatus === undefined ||
		session.executionStatus === "notStarted") &&
	session.planningStatus !== "provisional" &&
	session.sessionPurpose !== "diagnostic";

const ownedPlan = async (ctx: MutationCtx, id: Doc<"learningPlans">["_id"]) => {
	const identity = await ctx.auth.getUserIdentity();
	const plan = await ctx.db.get("learningPlans", id);
	if (
		!identity ||
		!plan ||
		plan.ownerTokenIdentifier !== identity.tokenIdentifier
	) {
		throwUserFacingError("Lernplan nicht gefunden.");
	}
	if (plan.status !== "accepted")
		throwUserFacingError("Übernimm zuerst den Lernplan.");
	return plan;
};

export const claim = internalMutation({
	args: { learningPlanId: v.id("learningPlans"), updateId: v.string() },
	returns: v.object({
		revision: v.number(),
		sessionIds: v.array(v.id("learningPlanSessions")),
	}),
	handler: async (ctx, args) => {
		const plan = await ownedPlan(ctx, args.learningPlanId);
		if ((plan.materialRevision ?? 0) <= (plan.appliedMaterialRevision ?? 0)) {
			throwUserFacingError("Dein Material ist bereits berücksichtigt.");
		}
		if (
			plan.materialUpdateStartedAt &&
			Date.now() - plan.materialUpdateStartedAt < UPDATE_TIMEOUT_MS
		) {
			throwUserFacingError("Dein Material wird bereits berücksichtigt.");
		}
		const sessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_learningPlanId_and_sortOrder", (q) =>
				q.eq("learningPlanId", plan._id),
			)
			.take(MAX_SESSIONS + 1);
		if (sessions.length > MAX_SESSIONS)
			throwUserFacingError(
				"Dieser Lernplan ist zu groß für eine gemeinsame Materialaktualisierung.",
			);
		const eligible = [];
		for (const session of sessions) {
			if (!canUpdateMaterialContent(session)) continue;
			const attempt = await ctx.db
				.query("learningSessionAnswerAttempts")
				.withIndex("by_sessionId_and_createdAt", (q) =>
					q.eq("sessionId", session._id),
				)
				.first();
			const analysis = await ctx.db
				.query("learningSessionAnalyses")
				.withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
				.first();
			if (attempt || analysis) continue;
			if (session.contentGenerationStatus === "generating")
				throwUserFacingError(
					"Warte, bis die laufende Erstellung abgeschlossen ist.",
				);
			eligible.push(session._id);
		}
		await ctx.db.patch("learningPlans", plan._id, {
			materialUpdateId: args.updateId,
			materialUpdateStartedAt: Date.now(),
			materialUpdateError: undefined,
		});
		return { revision: plan.materialRevision ?? 0, sessionIds: eligible };
	},
});

export const finish = internalMutation({
	args: {
		learningPlanId: v.id("learningPlans"),
		updateId: v.string(),
		revision: v.number(),
		sourceSummary: v.string(),
		topics: v.array(learningTopicValidator),
		additionalMinutes: v.number(),
		sessions: v.array(
			v.object({
				sessionId: v.id("learningPlanSessions"),
				expectedSession: v.string(),
				expectedContent: v.string(),
				items: v.array(generatedSessionContentItemValidator),
			}),
		),
	},
	returns: v.object({
		updatedSessionCount: v.number(),
		preservedSessionCount: v.number(),
		additionalMinutes: v.number(),
	}),
	handler: async (ctx, args) => {
		const plan = await ownedPlan(ctx, args.learningPlanId);
		if (
			plan.materialUpdateId !== args.updateId ||
			(plan.materialRevision ?? 0) !== args.revision
		) {
			throwUserFacingError(
				"Das Material wurde zwischenzeitlich geändert. Starte die Aktualisierung erneut.",
			);
		}
		if (
			args.topics.length > 12 ||
			!Number.isFinite(args.additionalMinutes) ||
			args.additionalMinutes < 0
		) {
			throwUserFacingError(
				"Die Materialanalyse konnte nicht sicher übernommen werden.",
			);
		}
		const coveredTopics = new Set(
			(plan.topicReadiness ?? [])
				.filter((topic) => topic.status === "secure")
				.map((topic) => topic.topicId),
		);
		let updatedSessionCount = 0;
		const preservedSessionCount = 0;
		for (const generated of args.sessions) {
			const session = await ctx.db.get(
				"learningPlanSessions",
				generated.sessionId,
			);
			if (
				!session ||
				session.learningPlanId !== plan._id ||
				session.ownerTokenIdentifier !== plan.ownerTokenIdentifier
			) {
				throwUserFacingError(
					"Der Lernplan wurde zwischenzeitlich geändert. Versuche es erneut.",
				);
			}
			const attempts = await ctx.db
				.query("learningSessionAnswerAttempts")
				.withIndex("by_sessionId_and_createdAt", (q) =>
					q.eq("sessionId", session._id),
				)
				.first();
			const analysis = await ctx.db
				.query("learningSessionAnalyses")
				.withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
				.first();
			if (!canUpdateMaterialContent(session) || attempts || analysis) {
				throwUserFacingError(
					"Ein Lernblock wurde inzwischen begonnen. Deine Inhalte bleiben erhalten. Starte die Aktualisierung erneut.",
				);
			}
			const items = await ctx.db
				.query("learningSessionContentItems")
				.withIndex("by_sessionId_and_sortOrder", (q) =>
					q.eq("sessionId", session._id),
				)
				.take(1001);
			if (
				JSON.stringify(session) !== generated.expectedSession ||
				items.length > 1000 ||
				JSON.stringify(items) !== generated.expectedContent ||
				generated.items.length === 0
			) {
				throwUserFacingError(
					"Ein Lernblock wurde zwischenzeitlich geändert. Versuche es erneut.",
				);
			}
			await ctx.runMutation(
				internal.learningSessionContent.storeGeneratedSessionContent,
				{
					sessionId: session._id,
					items: generated.items,
					replaceExisting: true,
				},
			);
			const targetTopicIds = [
				...new Set(
					generated.items.flatMap((item) =>
						item.topicId ? [item.topicId] : [],
					),
				),
			];
			for (const id of targetTopicIds) coveredTopics.add(id);
			await ctx.db.patch("learningPlanSessions", session._id, {
				targetTopicIds,
				contentGenerationStatus: "ready",
				contentGenerationError: undefined,
				contentGeneratedAt: Date.now(),
			});
			updatedSessionCount++;
		}
		// Preserve stable topic identities and all recorded readiness/evidence.
		const previousTopics = plan.topicMap ?? [];
		const topics = [...previousTopics];
		for (const topic of args.topics) {
			const previous = topics.findIndex((t) => t.id === topic.id);
			if (previous >= 0) topics[previous] = topic;
			else topics.push(topic);
		}
		if (topics.length > 12)
			throwUserFacingError(
				"Die neuen Themen überschreiten den Umfang dieses Lernplans. Erstelle dafür einen weiteren Lernplan.",
			);
		await ctx.db.patch("learningPlans", plan._id, {
			sourceSummary: args.sourceSummary,
			topicMap: topics,
			appliedMaterialRevision: args.revision,
			materialUpdateId: undefined,
			materialUpdateStartedAt: undefined,
			materialUpdateError: undefined,
			materialAdditionalMinutes: args.additionalMinutes,
			materialUncoveredTopics: args.topics
				.filter((topic) => !coveredTopics.has(topic.id))
				.map((topic) => topic.title),
			updatedAt: Date.now(),
		});
		return {
			updatedSessionCount,
			preservedSessionCount,
			additionalMinutes: args.additionalMinutes,
		};
	},
});

export const fail = internalMutation({
	args: { learningPlanId: v.id("learningPlans"), updateId: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const plan = await ownedPlan(ctx, args.learningPlanId);
		if (plan.materialUpdateId === args.updateId) {
			await ctx.db.patch("learningPlans", plan._id, {
				materialUpdateId: undefined,
				materialUpdateStartedAt: undefined,
				materialUpdateError:
					"Die Aktualisierung wurde nicht übernommen. Deine bisherigen Inhalte bleiben erhalten. Versuche es erneut.",
			});
		}
		return null;
	},
});
