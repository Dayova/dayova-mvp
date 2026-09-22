import {
	start,
	vResultValidator,
	vWorkflowId,
	WorkflowManager,
} from "@convex-dev/workflow";
import { v } from "convex/values";
import { AI_CONSENT_VERSION } from "../src/lib/ai-consent";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	action,
	env,
	internalMutation,
	internalQuery,
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { assertAccountActive } from "./accountDeletion";
import { throwUserFacingError } from "./errors";
import { createManagedReadUrl } from "./fileStorage";
import {
	canOfferPodcast,
	isPodcastSubject,
	podcastFields,
	podcastScriptValidator,
	validatePodcastScript,
} from "./podcastContent";

const workflow = new WorkflowManager(components.workflow);
const jobArgs = { podcastId: v.id("learningPodcasts"), attempt: v.number() };
const podcastDoc = v.object({
	...podcastFields,
	_id: v.id("learningPodcasts"),
	_creationTime: v.number(),
});

export const sources = query({
	args: { sessionId: v.id("learningPlanSessions") },
	returns: v.array(
		v.object({ id: v.id("learningPlanDocuments"), fileName: v.string() }),
	),
	handler: async (ctx, { sessionId }) => {
		const { plan } = await ownedSession(ctx, sessionId);
		const documents = await ctx.db
			.query("learningPlanDocuments")
			.withIndex("by_learningPlanId", (q) => q.eq("learningPlanId", plan._id))
			.take(50);
		return documents.map((document) => ({
			id: document._id,
			fileName: document.fileName,
		}));
	},
});

export const sourceContext = internalQuery({
	args: { documentId: v.id("learningPlanDocuments") },
	returns: v.object({
		storageId: v.string(),
		storageProvider: v.union(v.literal("convex"), v.literal("r2")),
		accessKey: v.string(),
	}),
	handler: async (ctx, { documentId }) => {
		const identity = await ctx.auth.getUserIdentity();
		const document = await ctx.db.get("learningPlanDocuments", documentId);
		if (
			!identity ||
			!document ||
			document.ownerTokenIdentifier !== identity.tokenIdentifier
		)
			throwUserFacingError("Material nicht gefunden.");
		await assertAccountActive(ctx, identity.tokenIdentifier);
		return {
			storageId: document.storageId,
			storageProvider: document.storageProvider,
			accessKey: identity.tokenIdentifier,
		};
	},
});

export const openSource = action({
	args: { documentId: v.id("learningPlanDocuments") },
	returns: v.string(),
	handler: async (ctx, args): Promise<string> => {
		const source = await ctx.runQuery(
			internal.learningPodcasts.sourceContext,
			args,
		);
		return await createManagedReadUrl(ctx, source, source.accessKey);
	},
});

async function ownedSession(
	ctx: QueryCtx | MutationCtx,
	sessionId: Id<"learningPlanSessions">,
) {
	const identity = await ctx.auth.getUserIdentity();
	if (identity) await assertAccountActive(ctx, identity.tokenIdentifier);
	const session = await ctx.db.get("learningPlanSessions", sessionId);
	if (
		!identity ||
		!session ||
		session.ownerTokenIdentifier !== identity.tokenIdentifier
	)
		throwUserFacingError("Lerneinheit nicht gefunden.");
	const plan = await ctx.db.get("learningPlans", session.learningPlanId);
	if (!plan || plan.ownerTokenIdentifier !== identity.tokenIdentifier)
		throwUserFacingError("Lernplan nicht gefunden.");
	return { session, plan };
}

async function sourceFor(
	ctx: QueryCtx | MutationCtx,
	session: Doc<"learningPlanSessions">,
) {
	const items = await ctx.db
		.query("learningSessionContentItems")
		.withIndex("by_sessionId_and_sortOrder", (q) =>
			q.eq("sessionId", session._id),
		)
		.take(101);
	const cards = items.filter((item) => item.kind === "learnCard");
	if (items.length > 100 || cards.length === 0)
		throwUserFacingError(
			"Öffne zuerst die Theorie, damit die Lerninhalte vorbereitet werden.",
		);
	const source = JSON.stringify(
		cards.map((item) => ({
			title: item.title,
			content: item.theoryContent ?? {
				explanation: item.back ?? item.explanation,
				question: item.prompt,
			},
		})),
	);
	if (source.length > 50000)
		throwUserFacingError(
			"Diese Theorie-Einheit ist für einen kurzen Podcast zu umfangreich.",
		);
	const plan = await ctx.db.get("learningPlans", session.learningPlanId);
	return {
		source,
		fingerprint: JSON.stringify({
			subject: plan?.subject,
			goal: session.goal,
			cards: cards.map((item) => [item._id, item.updatedAt]),
		}),
	};
}

async function requireConsent(ctx: QueryCtx | MutationCtx, owner: string) {
	await assertAccountActive(ctx, owner);
	const user = await ctx.db
		.query("users")
		.withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", owner))
		.unique();
	if (
		user?.aiConsentStatus !== "granted" ||
		user.aiConsentVersion !== AI_CONSENT_VERSION
	)
		throwUserFacingError(
			"Bestätige zuerst die KI-Datenverarbeitung in den Einstellungen.",
		);
}

export const get = query({
	args: { sessionId: v.id("learningPlanSessions") },
	returns: v.object({
		eligible: v.boolean(),
		needsLanguageConfirmation: v.boolean(),
		episode: v.union(
			v.null(),
			v.object({
				...podcastFields,
				_id: v.id("learningPodcasts"),
				_creationTime: v.number(),
				audioUrl: v.union(v.string(), v.null()),
			}),
		),
	}),
	handler: async (ctx, { sessionId }) => {
		const { session, plan } = await ownedSession(ctx, sessionId);
		const eligible =
			session.phase === "theory" &&
			session.sessionPurpose !== "diagnostic" &&
			session.planningStatus !== "provisional" &&
			(isPodcastSubject(plan.subject) || plan.podcastLanguageSubject === true);
		const episode = await ctx.db
			.query("learningPodcasts")
			.withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
			.unique();
		// A theory upgrade can update cards in place. Never serve an episode
		// from an older source; the same request action will replace it.
		const currentSource =
			eligible && episode ? await sourceFor(ctx, session) : null;
		const currentEpisode =
			episode && currentSource?.fingerprint === episode.fingerprint
				? episode
				: null;
		return {
			eligible,
			needsLanguageConfirmation:
				session.phase === "theory" &&
				session.sessionPurpose !== "diagnostic" &&
				session.planningStatus !== "provisional" &&
				!eligible &&
				canOfferPodcast(plan.subject),
			episode: currentEpisode
				? {
						...currentEpisode,
						audioUrl: currentEpisode.storageId
							? await ctx.storage.getUrl(currentEpisode.storageId)
							: null,
					}
				: null,
		};
	},
});

export const confirmLanguageSubject = mutation({
	args: { sessionId: v.id("learningPlanSessions") },
	returns: v.null(),
	handler: async (ctx, { sessionId }) => {
		const { plan } = await ownedSession(ctx, sessionId);
		if (!canOfferPodcast(plan.subject))
			throwUserFacingError("Dieses Fach ist kein Sprachfach.");
		await ctx.db.patch("learningPlans", plan._id, {
			podcastLanguageSubject: true,
		});
		return null;
	},
});

export const request = mutation({
	args: { sessionId: v.id("learningPlanSessions") },
	returns: v.id("learningPodcasts"),
	handler: async (ctx, { sessionId }): Promise<Id<"learningPodcasts">> => {
		const { session, plan } = await ownedSession(ctx, sessionId);
		if (
			session.phase !== "theory" ||
			session.sessionPurpose === "diagnostic" ||
			session.planningStatus === "provisional" ||
			!(isPodcastSubject(plan.subject) || plan.podcastLanguageSubject === true)
		)
			throwUserFacingError(
				"Podcasts stehen für Theorie in sprachlichen Fächern zur Verfügung.",
			);
		await requireConsent(ctx, session.ownerTokenIdentifier);
		const { fingerprint } = await sourceFor(ctx, session);
		const existing = await ctx.db
			.query("learningPodcasts")
			.withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
			.unique();
		if (
			existing &&
			existing.fingerprint === fingerprint &&
			existing.status !== "failed"
		)
			return existing._id;
		if (existing && existing.status !== "failed" && existing.status !== "ready")
			throwUserFacingError(
				"Der Podcast wird noch erstellt. Versuche es gleich erneut.",
			);
		if (
			existing &&
			existing.attempt >= 3 &&
			existing.fingerprint === fingerprint
		)
			throwUserFacingError(
				"Die Podcast-Erstellung ist derzeit nicht verfügbar. Bitte kontaktiere den Support.",
			);
		if (!env.GOOGLE_VERTEX_API_KEY && !env.GOOGLE_VERTEX_PROJECT)
			throwUserFacingError(
				"Die Podcast-Erstellung ist noch nicht eingerichtet. Du kannst die Theorie weiterhin lesen.",
			);
		const attempt =
			existing && existing.fingerprint === fingerprint
				? existing.attempt + 1
				: 1;
		const now = Date.now();
		const fields = {
			ownerTokenIdentifier: session.ownerTokenIdentifier,
			learningPlanId: plan._id,
			sessionId,
			fingerprint,
			status: "script" as const,
			attempt,
			positionSeconds: 0,
			listened: false,
			answers: [],
			createdAt: now,
			updatedAt: now,
		};
		let podcastId: Id<"learningPodcasts">;
		if (existing) {
			if (existing.storageId) await ctx.storage.delete(existing.storageId);
			await ctx.db.replace("learningPodcasts", existing._id, fields);
			podcastId = existing._id;
		} else podcastId = await ctx.db.insert("learningPodcasts", fields);
		await start(
			ctx,
			internal.learningPodcasts.generate,
			{ podcastId, attempt },
			{
				onComplete: internal.learningPodcasts.onComplete,
				context: { podcastId, attempt },
			},
		);
		return podcastId;
	},
});

export const generationContext = internalQuery({
	args: jobArgs,
	returns: v.object({
		episode: podcastDoc,
		source: v.string(),
		subject: v.string(),
		goal: v.string(),
	}),
	handler: async (ctx, args) => {
		const episode = await ctx.db.get("learningPodcasts", args.podcastId);
		if (!episode || episode.attempt !== args.attempt)
			throw new Error("Podcast generation canceled");
		const session = await ctx.db.get("learningPlanSessions", episode.sessionId);
		const plan = await ctx.db.get("learningPlans", episode.learningPlanId);
		if (
			!session ||
			!plan ||
			session.ownerTokenIdentifier !== episode.ownerTokenIdentifier ||
			plan.ownerTokenIdentifier !== episode.ownerTokenIdentifier
		)
			throw new Error("Podcast source removed");
		await requireConsent(ctx, episode.ownerTokenIdentifier);
		const source = await sourceFor(ctx, session);
		if (source.fingerprint !== episode.fingerprint)
			throw new Error("Podcast source changed");
		return {
			episode,
			source: source.source,
			subject: plan.subject,
			goal: session.goal,
		};
	},
});

export const saveScript = internalMutation({
	args: { ...jobArgs, script: podcastScriptValidator },
	returns: v.null(),
	handler: async (ctx, args) => {
		const episode = await ctx.db.get("learningPodcasts", args.podcastId);
		if (!episode || episode.attempt !== args.attempt)
			throw new Error("Podcast generation canceled");
		await ctx.db.patch("learningPodcasts", episode._id, {
			script: validatePodcastScript(args.script),
			status: "audio",
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const saveAudio = internalMutation({
	args: {
		...jobArgs,
		storageId: v.id("_storage"),
		durationSeconds: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const episode = await ctx.db.get("learningPodcasts", args.podcastId);
		if (!episode || episode.attempt !== args.attempt) {
			await ctx.storage.delete(args.storageId);
			return null;
		}
		const session = await ctx.db.get("learningPlanSessions", episode.sessionId);
		if (
			!session ||
			(await sourceFor(ctx, session)).fingerprint !== episode.fingerprint
		) {
			await ctx.storage.delete(args.storageId);
			throw new Error("Podcast source changed");
		}
		await requireConsent(ctx, episode.ownerTokenIdentifier);
		await ctx.db.patch("learningPodcasts", episode._id, {
			storageId: args.storageId,
			durationSeconds: args.durationSeconds,
			status: "ready",
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const generate = workflow
	.define({ args: jobArgs, returns: v.null() })
	.handler(async (step, args): Promise<null> => {
		await step.runAction(internal.podcastAi.createScript, args, {
			retry: false,
		});
		await step.runAction(internal.podcastAi.createAudio, args, {
			retry: false,
		});
		return null;
	});

export const onComplete = internalMutation({
	args: {
		workflowId: vWorkflowId,
		result: vResultValidator,
		context: v.object(jobArgs),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const episode = await ctx.db.get(
			"learningPodcasts",
			args.context.podcastId,
		);
		if (
			episode &&
			episode.attempt === args.context.attempt &&
			args.result.kind !== "success"
		) {
			await ctx.db.patch("learningPodcasts", episode._id, {
				status: "failed",
				error:
					"Der Podcast konnte nicht erstellt werden. Bitte versuche es erneut.",
				updatedAt: Date.now(),
			});
		}
		await workflow.cleanup(ctx, args.workflowId);
		return null;
	},
});

export const saveProgress = mutation({
	args: { podcastId: v.id("learningPodcasts"), positionSeconds: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const episode = await ctx.db.get("learningPodcasts", args.podcastId);
		if (!episode) throwUserFacingError("Podcast nicht gefunden.");
		await ownedSession(ctx, episode.sessionId);
		if (!Number.isFinite(args.positionSeconds) || args.positionSeconds < 0)
			throwUserFacingError("Ungültige Wiedergabeposition.");
		const positionSeconds = Math.min(
			args.positionSeconds,
			episode.durationSeconds ?? 0,
		);
		await ctx.db.patch("learningPodcasts", episode._id, {
			positionSeconds,
			listened:
				episode.listened ||
				positionSeconds >= (episode.durationSeconds ?? Infinity) - 2,
		});
		return null;
	},
});

export const answer = mutation({
	args: {
		podcastId: v.id("learningPodcasts"),
		questionIndex: v.number(),
		optionIndex: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const episode = await ctx.db.get("learningPodcasts", args.podcastId);
		if (!episode) throwUserFacingError("Podcast nicht gefunden.");
		await ownedSession(ctx, episode.sessionId);
		const question = episode.script?.questions[args.questionIndex];
		if (
			!Number.isInteger(args.questionIndex) ||
			!Number.isInteger(args.optionIndex) ||
			!question?.options[args.optionIndex]
		)
			throwUserFacingError("Wähle eine gültige Antwort.");
		const answers =
			episode.script?.questions.map((_, index) =>
				index === args.questionIndex
					? args.optionIndex
					: (episode.answers[index] ?? -1),
			) ?? [];
		await ctx.db.patch("learningPodcasts", episode._id, { answers });
		// Practice feedback is local to the podcast; it never certifies topic mastery.
		return null;
	},
});

export async function deleteSessionPodcast(
	ctx: MutationCtx,
	sessionId: Id<"learningPlanSessions">,
) {
	const episode = await ctx.db
		.query("learningPodcasts")
		.withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
		.unique();
	if (episode) {
		if (episode.storageId) await ctx.storage.delete(episode.storageId);
		await ctx.db.delete("learningPodcasts", episode._id);
	}
}
