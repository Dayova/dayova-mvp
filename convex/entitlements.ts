import { v } from "convex/values";
import {
	TRIAL_DURATION_DAYS,
	TRIAL_REMINDER_DAYS_BEFORE_END,
	TRIAL_TERMS_VERSION,
} from "../src/lib/trial-policy";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import {
	accessValidator,
	getStoredAccess,
	refreshOwnerAccess,
} from "./accessState";
import { assertAccountActive } from "./accountDeletion";
import { enqueueCrmUpdate } from "./crmUpdates";

import {
	getCurrentAccess,
	getPaidThrough,
	toTrialAccess,
} from "./entitlementPolicy";
import { throwUserFacingError } from "./errors";

const DAY_MS = 24 * 60 * 60 * 1000;

async function scheduleCrmSync(ctx: MutationCtx, userId: Doc<"users">["_id"]) {
	await enqueueCrmUpdate(ctx, userId);
}

export { getCurrentAccess } from "./entitlementPolicy";

const getCurrentUser = async (ctx: MutationCtx | QueryCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throwUserFacingError("Nicht authentifiziert.");
	}
	await assertAccountActive(ctx, identity.tokenIdentifier);

	const user = await ctx.db
		.query("users")
		.withIndex("by_tokenIdentifier", (query) =>
			query.eq("tokenIdentifier", identity.tokenIdentifier),
		)
		.unique();
	if (!user) {
		throwUserFacingError("Der Nutzer konnte nicht gefunden werden.");
	}

	return { identity, user };
};

export const getMyAccess = query({
	args: {
		now: v.optional(v.number()),
	},
	returns: accessValidator,
	handler: async (ctx) => {
		const { identity } = await getCurrentUser(ctx);
		const entitlement = await ctx.db
			.query("accessEntitlements")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", identity.tokenIdentifier),
			)
			.unique();

		if (!entitlement) {
			return {
				canUseApp: false as const,
				state: "needsActivation" as const,
			};
		}

		return getStoredAccess(entitlement);
	},
});

export const applyRevenueCatSnapshot = internalMutation({
	args: {
		ownerTokenIdentifier: v.string(),
		active: v.boolean(),
		expiresAt: v.optional(v.number()),
		graceExpiresAt: v.optional(v.number()),
		productId: v.optional(v.string()),
		periodType: v.optional(v.string()),
		store: v.optional(v.string()),
		willRenew: v.optional(v.boolean()),
		billingIssueDetectedAt: v.optional(v.number()),
		managementUrl: v.optional(v.string()),
		verifiedAt: v.number(),
	},
	returns: v.object({ success: v.literal(true) }),
	handler: async (ctx, args) => {
		const entitlement = await ctx.db
			.query("accessEntitlements")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", args.ownerTokenIdentifier),
			)
			.unique();
		if (!entitlement) {
			if (!args.active) {
				return { success: true as const };
			}

			const user = await ctx.db
				.query("users")
				.withIndex("by_tokenIdentifier", (query) =>
					query.eq("tokenIdentifier", args.ownerTokenIdentifier),
				)
				.unique();
			if (!user) {
				throwUserFacingError("Der Nutzer konnte nicht gefunden werden.");
			}

			await ctx.db.insert("accessEntitlements", {
				ownerTokenIdentifier: args.ownerTokenIdentifier,
				userId: user._id,
				revenueCatEntitlementActive: true,
				...(args.expiresAt !== undefined
					? { subscriptionExpiresAt: args.expiresAt }
					: {}),
				...(args.graceExpiresAt !== undefined
					? { subscriptionGraceExpiresAt: args.graceExpiresAt }
					: {}),
				...(args.productId !== undefined
					? { subscriptionProductId: args.productId }
					: {}),
				...(args.periodType !== undefined
					? { subscriptionPeriodType: args.periodType }
					: {}),
				...(args.store !== undefined ? { subscriptionStore: args.store } : {}),
				...(args.willRenew !== undefined
					? { subscriptionWillRenew: args.willRenew }
					: {}),
				...(args.billingIssueDetectedAt !== undefined
					? {
							subscriptionBillingIssueDetectedAt: args.billingIssueDetectedAt,
						}
					: {}),
				...(args.managementUrl !== undefined
					? { subscriptionManagementUrl: args.managementUrl }
					: {}),
				subscriptionVerifiedAt: args.verifiedAt,
				createdAt: args.verifiedAt,
				updatedAt: args.verifiedAt,
			});
			await refreshOwnerAccess(ctx, user.tokenIdentifier);
			await scheduleCrmSync(ctx, user._id);

			return { success: true as const };
		}

		const subscription = {
			revenueCatEntitlementActive: args.active,
			subscriptionExpiresAt: args.expiresAt,
			subscriptionGraceExpiresAt: args.graceExpiresAt,
			subscriptionProductId: args.productId,
			// An omitted period is unknown now; retaining a previous trial/paid phase
			// could mislabel a subscription that changed since the last snapshot.
			subscriptionPeriodType: args.periodType,
			subscriptionStore: args.store,
			subscriptionWillRenew: args.willRenew,
			subscriptionBillingIssueDetectedAt: args.billingIssueDetectedAt,
			subscriptionManagementUrl: args.managementUrl,
		};
		const changed = Object.entries(subscription).some(
			([key, value]) => entitlement[key as keyof typeof subscription] !== value,
		);
		await ctx.db.patch("accessEntitlements", entitlement._id, {
			...subscription,
			subscriptionVerifiedAt: args.verifiedAt,
			updatedAt: args.verifiedAt,
		});
		await refreshOwnerAccess(ctx, args.ownerTokenIdentifier);
		if (changed || entitlement.subscriptionVerifiedAt === undefined) {
			await scheduleCrmSync(ctx, entitlement.userId);
		}

		return { success: true as const };
	},
});

export const findOwnersByClerkIds = internalQuery({
	args: {
		clerkIds: v.array(v.string()),
	},
	returns: v.array(
		v.object({
			clerkId: v.string(),
			ownerTokenIdentifier: v.string(),
		}),
	),
	handler: async (ctx, args) => {
		const owners: Array<{
			clerkId: string;
			ownerTokenIdentifier: string;
		}> = [];
		const ownerTokens = new Set<string>();

		for (const clerkId of args.clerkIds) {
			const user = await ctx.db
				.query("users")
				.withIndex("by_clerkId", (query) => query.eq("clerkId", clerkId))
				.unique();
			if (user && !ownerTokens.has(user.tokenIdentifier)) {
				ownerTokens.add(user.tokenIdentifier);
				owners.push({
					clerkId,
					ownerTokenIdentifier: user.tokenIdentifier,
				});
			}
		}

		return owners;
	},
});

export const deliverTrialReminder = internalMutation({
	args: {
		expectedTrialExpiresAt: v.number(),
		ownerTokenIdentifier: v.string(),
	},
	handler: async (ctx, args) => {
		const entitlement = await ctx.db
			.query("accessEntitlements")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", args.ownerTokenIdentifier),
			)
			.unique();
		if (
			!entitlement ||
			entitlement.trialExpiresAt !== args.expectedTrialExpiresAt
		) {
			return { created: false };
		}

		const now = Date.now();
		if (
			entitlement.revenueCatEntitlementActive &&
			now < getPaidThrough(entitlement)
		) {
			return { created: false };
		}

		const eventKey = `trial-ending:${entitlement.trialReminderAt}`;
		const existing = await ctx.db
			.query("notificationHistory")
			.withIndex("by_ownerTokenIdentifier_and_eventKey", (query) =>
				query
					.eq("ownerTokenIdentifier", args.ownerTokenIdentifier)
					.eq("eventKey", eventKey),
			)
			.unique();
		if (existing) return { created: false };

		await ctx.db.insert("notificationHistory", {
			ownerTokenIdentifier: args.ownerTokenIdentifier,
			eventKey,
			category: "message",
			type: "trialEnding",
			title: "Deine Testphase endet bald",
			body: "Deine kostenlose Testphase endet in 2 Tagen. Danach entscheidest du selbst, wie es weitergeht.",
			triggeredAt: now,
			createdAt: now,
		});

		return { created: true };
	},
});

const subscriptionAccessMetadataValidator = v.object({
	managementUrl: v.optional(v.string()),
	productId: v.optional(v.string()),
	store: v.optional(v.string()),
	subscriptionExpiresAt: v.optional(v.number()),
	subscriptionGraceExpiresAt: v.optional(v.number()),
	willRenew: v.boolean(),
});
/** Grants a first trial for current terms; repeated activation preserves stored access. */
export const activateMyTrial = mutation({
	args: {
		termsVersion: v.string(),
	},
	returns: v.union(
		v.object({
			canUseApp: v.literal(true),
			state: v.literal("trial"),
			trialStartedAt: v.number(),
			trialExpiresAt: v.number(),
			reminderAt: v.number(),
			trialTermsVersion: v.string(),
		}),
		subscriptionAccessMetadataValidator.extend({
			canUseApp: v.literal(true),
			state: v.union(v.literal("paid"), v.literal("billingGrace")),
		}),
		subscriptionAccessMetadataValidator.extend({
			canUseApp: v.literal(false),
			state: v.literal("expired"),
			trialStartedAt: v.optional(v.number()),
			trialExpiresAt: v.optional(v.number()),
			reminderAt: v.optional(v.number()),
			trialTermsVersion: v.optional(v.string()),
		}),
	),
	handler: async (ctx, args) => {
		const { identity, user } = await getCurrentUser(ctx);
		const existing = await ctx.db
			.query("accessEntitlements")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", identity.tokenIdentifier),
			)
			.unique();
		if (existing) {
			// Preserve every stored cohort, including manual extensions. Migrating
			// existing trials needs a separate decision; activation never regrants one.
			await refreshOwnerAccess(ctx, identity.tokenIdentifier);
			return getCurrentAccess(existing, Date.now());
		}

		if (args.termsVersion !== TRIAL_TERMS_VERSION) {
			throwUserFacingError(
				"Bitte aktualisiere Dayova und akzeptiere die aktuellen Nutzungsbedingungen, um deine Testphase zu starten.",
			);
		}

		const now = Date.now();
		const trialExpiresAt = now + TRIAL_DURATION_DAYS * DAY_MS;
		const reminderAt = trialExpiresAt - TRIAL_REMINDER_DAYS_BEFORE_END * DAY_MS;

		const entitlement = {
			ownerTokenIdentifier: identity.tokenIdentifier,
			userId: user._id,
			trialStartedAt: now,
			trialExpiresAt,
			trialReminderAt: reminderAt,
			trialTermsVersion: args.termsVersion,
			createdAt: now,
			updatedAt: now,
		};
		await ctx.db.insert("accessEntitlements", entitlement);
		await refreshOwnerAccess(ctx, identity.tokenIdentifier);
		await scheduleCrmSync(ctx, user._id);
		await ctx.scheduler.runAt(
			reminderAt,
			internal.entitlements.deliverTrialReminder,
			{
				expectedTrialExpiresAt: trialExpiresAt,
				ownerTokenIdentifier: identity.tokenIdentifier,
			},
		);

		return toTrialAccess(entitlement);
	},
});
