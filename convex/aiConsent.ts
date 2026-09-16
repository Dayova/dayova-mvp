import { v } from "convex/values";
import type { AiConsentSnapshot } from "../src/lib/ai-consent";
import {
	AI_CONSENT_REQUIRED_MESSAGE,
	AI_CONSENT_VERSION,
} from "../src/lib/ai-consent";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalQuery, mutation, query } from "./_generated/server";
import { throwUserFacingError } from "./errors";

const aiConsentStatusValidator = v.union(
	v.literal("notSet"),
	v.literal("granted"),
	v.literal("declined"),
	v.literal("withdrawn"),
);

const aiConsentSnapshotValidator = v.object({
	status: aiConsentStatusValidator,
	version: v.union(v.string(), v.null()),
	updatedAt: v.union(v.number(), v.null()),
	grantedAt: v.union(v.number(), v.null()),
	hasCurrentConsent: v.boolean(),
});

const requireIdentity = async (ctx: QueryCtx | MutationCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throwUserFacingError("Nicht authentifiziert.");
	return identity;
};

const getCurrentUser = async (ctx: QueryCtx | MutationCtx) => {
	const identity = await requireIdentity(ctx);
	const user = await ctx.db
		.query("users")
		.withIndex("by_tokenIdentifier", (query) =>
			query.eq("tokenIdentifier", identity.tokenIdentifier),
		)
		.unique();
	if (!user) throwUserFacingError("Der Nutzer konnte nicht gefunden werden.");
	return user;
};

const toSnapshot = (user: Doc<"users">): AiConsentSnapshot => {
	const status = user.aiConsentStatus ?? "notSet";
	return {
		status,
		version: user.aiConsentVersion ?? null,
		updatedAt: user.aiConsentUpdatedAt ?? null,
		grantedAt: user.aiConsentGrantedAt ?? null,
		hasCurrentConsent:
			status === "granted" && user.aiConsentVersion === AI_CONSENT_VERSION,
	};
};

export const getMine = query({
	args: {},
	returns: aiConsentSnapshotValidator,
	handler: async (ctx) => toSnapshot(await getCurrentUser(ctx)),
});

export const setDecision = mutation({
	args: {
		decision: v.union(v.literal("granted"), v.literal("declined")),
		version: v.string(),
	},
	returns: aiConsentSnapshotValidator,
	handler: async (ctx, args) => {
		if (args.version !== AI_CONSENT_VERSION) {
			throwUserFacingError(
				"Die Datenschutzhinweise wurden aktualisiert. Bitte öffne den Dialog erneut.",
			);
		}
		const user = await getCurrentUser(ctx);
		const now = Date.now();
		await ctx.db.patch("users", user._id, {
			aiConsentStatus: args.decision,
			aiConsentVersion: AI_CONSENT_VERSION,
			aiConsentUpdatedAt: now,
			...(args.decision === "granted" ? { aiConsentGrantedAt: now } : {}),
		});
		return toSnapshot({
			...user,
			aiConsentStatus: args.decision,
			aiConsentVersion: AI_CONSENT_VERSION,
			aiConsentUpdatedAt: now,
			...(args.decision === "granted" ? { aiConsentGrantedAt: now } : {}),
		});
	},
});

export const withdraw = mutation({
	args: {},
	returns: aiConsentSnapshotValidator,
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		const now = Date.now();
		await ctx.db.patch("users", user._id, {
			aiConsentStatus: "withdrawn",
			aiConsentUpdatedAt: now,
		});
		return toSnapshot({
			...user,
			aiConsentStatus: "withdrawn",
			aiConsentUpdatedAt: now,
		});
	},
});

export const requireCurrentConsent = internalQuery({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const snapshot = toSnapshot(await getCurrentUser(ctx));
		if (!snapshot.hasCurrentConsent) {
			throwUserFacingError(AI_CONSENT_REQUIRED_MESSAGE);
		}
		return null;
	},
});
