import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import { throwUserFacingError } from "./errors";

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DURATION_MS = 14 * DAY_MS;
const TRIAL_REMINDER_DELAY_MS = 12 * DAY_MS;

const getPaidThrough = (entitlement: {
	subscriptionExpiresAt?: number;
	subscriptionGraceExpiresAt?: number;
}) => {
	const accessDates = [
		entitlement.subscriptionExpiresAt,
		entitlement.subscriptionGraceExpiresAt,
	].filter((value): value is number => value !== undefined);
	return accessDates.length > 0
		? Math.max(...accessDates)
		: Number.POSITIVE_INFINITY;
};

const toTrialAccess = (entitlement: {
	trialStartedAt: number;
	trialExpiresAt: number;
	trialReminderAt: number;
	trialTermsVersion: string;
}) => ({
	canUseApp: true,
	state: "trial" as const,
	trialStartedAt: entitlement.trialStartedAt,
	trialExpiresAt: entitlement.trialExpiresAt,
	reminderAt: entitlement.trialReminderAt,
	trialTermsVersion: entitlement.trialTermsVersion,
});

const toPaidAccess = (entitlement: {
	subscriptionBillingIssueDetectedAt?: number;
	subscriptionExpiresAt?: number;
	subscriptionGraceExpiresAt?: number;
	subscriptionManagementUrl?: string;
	subscriptionProductId?: string;
	subscriptionStore?: string;
	subscriptionWillRenew?: boolean;
}) => ({
	canUseApp: true,
	managementUrl: entitlement.subscriptionManagementUrl,
	productId: entitlement.subscriptionProductId,
	state:
		entitlement.subscriptionBillingIssueDetectedAt &&
		entitlement.subscriptionGraceExpiresAt !== undefined
			? ("billingGrace" as const)
			: ("paid" as const),
	store: entitlement.subscriptionStore,
	subscriptionExpiresAt: entitlement.subscriptionExpiresAt,
	subscriptionGraceExpiresAt: entitlement.subscriptionGraceExpiresAt,
	willRenew: entitlement.subscriptionWillRenew ?? false,
});

const getCurrentAccess = (
	entitlement: Doc<"accessEntitlements">,
	now: number,
) => {
	if (
		entitlement.revenueCatEntitlementActive &&
		now < getPaidThrough(entitlement)
	) {
		return toPaidAccess(entitlement);
	}

	if (now >= entitlement.trialExpiresAt) {
		return {
			...toTrialAccess(entitlement),
			canUseApp: false,
			managementUrl: entitlement.subscriptionManagementUrl,
			productId: entitlement.subscriptionProductId,
			state: "expired" as const,
			store: entitlement.subscriptionStore,
			subscriptionExpiresAt: entitlement.subscriptionExpiresAt,
			subscriptionGraceExpiresAt: entitlement.subscriptionGraceExpiresAt,
			willRenew: entitlement.subscriptionWillRenew ?? false,
		};
	}

	return toTrialAccess(entitlement);
};

const getCurrentUser = async (ctx: MutationCtx | QueryCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throwUserFacingError("Nicht authentifiziert.");
	}

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
		now: v.number(),
	},
	handler: async (ctx, args) => {
		const { identity } = await getCurrentUser(ctx);
		const entitlement = await ctx.db
			.query("accessEntitlements")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", identity.tokenIdentifier),
			)
			.unique();

		if (!entitlement) {
			return {
				canUseApp: false,
				state: "needsActivation" as const,
			};
		}

		return getCurrentAccess(entitlement, args.now);
	},
});

export const applyRevenueCatSnapshot = internalMutation({
	args: {
		ownerTokenIdentifier: v.string(),
		active: v.boolean(),
		expiresAt: v.optional(v.number()),
		graceExpiresAt: v.optional(v.number()),
		productId: v.optional(v.string()),
		store: v.optional(v.string()),
		willRenew: v.optional(v.boolean()),
		billingIssueDetectedAt: v.optional(v.number()),
		managementUrl: v.optional(v.string()),
		verifiedAt: v.number(),
	},
	handler: async (ctx, args) => {
		const entitlement = await ctx.db
			.query("accessEntitlements")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", args.ownerTokenIdentifier),
			)
			.unique();
		if (!entitlement) {
			throwUserFacingError("Der Dayova-Zugang konnte nicht gefunden werden.");
		}

		await ctx.db.patch("accessEntitlements", entitlement._id, {
			revenueCatEntitlementActive: args.active,
			subscriptionExpiresAt: args.expiresAt,
			subscriptionGraceExpiresAt: args.graceExpiresAt,
			subscriptionProductId: args.productId,
			subscriptionStore: args.store,
			subscriptionWillRenew: args.willRenew,
			subscriptionBillingIssueDetectedAt: args.billingIssueDetectedAt,
			subscriptionManagementUrl: args.managementUrl,
			subscriptionVerifiedAt: args.verifiedAt,
			updatedAt: args.verifiedAt,
		});

		return { success: true };
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

export const activateMyTrial = mutation({
	args: {
		termsVersion: v.string(),
	},
	handler: async (ctx, args) => {
		const { identity, user } = await getCurrentUser(ctx);
		const existing = await ctx.db
			.query("accessEntitlements")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", identity.tokenIdentifier),
			)
			.unique();
		if (existing) {
			return getCurrentAccess(existing, Date.now());
		}

		const now = Date.now();
		const trialExpiresAt = now + TRIAL_DURATION_MS;
		const reminderAt = now + TRIAL_REMINDER_DELAY_MS;

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
