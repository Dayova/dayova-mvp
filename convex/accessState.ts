import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
	internalMutation,
	type MutationCtx,
	mutation,
	type QueryCtx,
} from "./_generated/server";
import { assertAccountActive } from "./accountDeletion";
import { getCurrentAccess, getPaidThrough } from "./entitlementPolicy";
import { throwUserFacingError } from "./errors";

const metadata = v.object({
	trialStartedAt: v.optional(v.number()),
	trialExpiresAt: v.optional(v.number()),
	reminderAt: v.optional(v.number()),
	trialTermsVersion: v.optional(v.string()),
	managementUrl: v.optional(v.string()),
	productId: v.optional(v.string()),
	store: v.optional(v.string()),
	subscriptionExpiresAt: v.optional(v.number()),
	subscriptionGraceExpiresAt: v.optional(v.number()),
	willRenew: v.optional(v.boolean()),
});
export const accessValidator = v.union(
	metadata.extend({
		state: v.union(v.literal("needsActivation"), v.literal("expired")),
		canUseApp: v.literal(false),
	}),
	metadata.extend({
		state: v.literal("trial"),
		canUseApp: v.literal(true),
		trialExpiresAt: v.number(),
	}),
	metadata.extend({
		state: v.union(v.literal("paid"), v.literal("billingGrace")),
		canUseApp: v.literal(true),
	}),
);
export async function findOwnerAccess(
	ctx: QueryCtx,
	ownerTokenIdentifier: string,
) {
	return await ctx.db
		.query("accessEntitlements")
		.withIndex("by_ownerTokenIdentifier", (q) =>
			q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
		)
		.unique();
}
// Reactive queries read a server-owned projection, never client time or Date.now().
export function getStoredAccess(row: Doc<"accessEntitlements">) {
	return row.accessEvaluatedAt === undefined
		? {
				...getCurrentAccess(row, Number.POSITIVE_INFINITY),
				state: "expired" as const,
				canUseApp: false as const,
			}
		: getCurrentAccess(row, row.accessEvaluatedAt);
}
export async function refreshOwnerAccess(
	ctx: MutationCtx,
	ownerTokenIdentifier: string,
	now = Date.now(),
) {
	const row = await findOwnerAccess(ctx, ownerTokenIdentifier);
	if (!row)
		return { state: "needsActivation" as const, canUseApp: false as const };
	const access = getCurrentAccess(row, now);
	const boundaries = [
		row.trialExpiresAt,
		row.revenueCatEntitlementActive ? getPaidThrough(row) : undefined,
	].filter(
		(date): date is number =>
			date !== undefined && Number.isFinite(date) && date > now,
	);
	const next = boundaries.length ? Math.min(...boundaries) : undefined;
	if (
		row.accessEvaluatedAt === undefined ||
		getStoredAccess(row).state !== access.state ||
		row.accessCheckAt !== next
	) {
		await ctx.db.patch("accessEntitlements", row._id, {
			accessEvaluatedAt: now,
			accessCheckAt: next,
		});
		if (next !== undefined)
			await ctx.scheduler.runAt(next, internal.accessState.evaluateBoundary, {
				ownerTokenIdentifier,
				expectedCheckAt: next,
			});
	}
	return access;
}
export const evaluateBoundary = internalMutation({
	args: { ownerTokenIdentifier: v.string(), expectedCheckAt: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const row = await findOwnerAccess(ctx, args.ownerTokenIdentifier);
		if (row?.accessCheckAt === args.expectedCheckAt)
			await refreshOwnerAccess(ctx, args.ownerTokenIdentifier);
		return null;
	},
});
export const refreshMyAccess = mutation({
	args: {},
	returns: v.object({ access: accessValidator, serverNow: v.number() }),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		await assertAccountActive(ctx, identity.tokenIdentifier);
		const serverNow = Date.now();
		return {
			access: await refreshOwnerAccess(
				ctx,
				identity.tokenIdentifier,
				serverNow,
			),
			serverNow,
		};
	},
});
export async function assertLearningAccess(
	ctx: QueryCtx,
	ownerTokenIdentifier: string,
	serverNow?: number,
) {
	await assertAccountActive(ctx, ownerTokenIdentifier);
	const row = await findOwnerAccess(ctx, ownerTokenIdentifier);
	const access =
		row &&
		(serverNow === undefined
			? getStoredAccess(row)
			: getCurrentAccess(row, serverNow));
	if (!access?.canUseApp)
		throwUserFacingError(
			"Dein Zugang ist abgelaufen oder noch nicht aktiviert. Bitte prüfe deinen Zugang in Dayova.",
		);
}
export const assertMyLearningAccess = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		await assertLearningAccess(ctx, identity.tokenIdentifier, Date.now());
		return null;
	},
});
