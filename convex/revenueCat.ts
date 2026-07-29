import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, env, internalAction } from "./_generated/server";
import { throwUserFacingError } from "./errors";
import { z } from "zod";

const ENTITLEMENT_ID = "dayova_full_access";
const REVENUECAT_REQUEST_TIMEOUT_MS = 10_000;

const optionalRevenueCatDate = z.string().nullable().optional();
const revenueCatSubscriberResponseSchema = z.object({
	subscriber: z.object({
		entitlements: z.record(
			z.string(),
			z.object({
				expires_date: optionalRevenueCatDate,
				grace_period_expires_date: optionalRevenueCatDate,
				product_identifier: z.string().optional(),
			}),
		),
		management_url: z.string().nullable().optional(),
		subscriptions: z.record(
			z.string(),
			z.object({
				billing_issues_detected_at: optionalRevenueCatDate,
				expires_date: optionalRevenueCatDate,
				grace_period_expires_date: optionalRevenueCatDate,
				store: z.string().optional(),
				unsubscribe_detected_at: optionalRevenueCatDate,
			}),
		),
	}),
});

const parseOptionalDate = (value: string | null | undefined) => {
	if (!value) return undefined;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : undefined;
};

const fetchSubscriberSnapshot = async (
	appUserId: string,
	secretApiKey: string,
) => {
	let response: Response;
	try {
		response = await fetch(
			`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
			{
				headers: {
					Authorization: `Bearer ${secretApiKey}`,
					Accept: "application/json",
				},
				signal: AbortSignal.timeout(REVENUECAT_REQUEST_TIMEOUT_MS),
			},
		);
	} catch {
		throwUserFacingError(
			"Dein Kaufstatus konnte nicht geprüft werden. Bitte versuche es erneut.",
		);
	}
	if (!response.ok) {
		throwUserFacingError(
			"Dein Kaufstatus konnte nicht geprüft werden. Bitte versuche es erneut.",
		);
	}

	let rawPayload: unknown;
	try {
		rawPayload = await response.json();
	} catch {
		throwUserFacingError(
			"Dein Kaufstatus konnte nicht geprüft werden. Bitte versuche es erneut.",
		);
	}
	const parsedPayload =
		revenueCatSubscriberResponseSchema.safeParse(rawPayload);
	if (!parsedPayload.success) {
		throwUserFacingError(
			"Dein Kaufstatus konnte nicht geprüft werden. Bitte versuche es erneut.",
		);
	}
	const payload = parsedPayload.data;
	const entitlement = payload.subscriber.entitlements[ENTITLEMENT_ID];
	const productId = entitlement?.product_identifier;
	const subscription = productId
		? payload.subscriber.subscriptions[productId]
		: undefined;
	const expiresAt = parseOptionalDate(entitlement?.expires_date);
	const graceExpiresAt =
		parseOptionalDate(subscription?.grace_period_expires_date) ??
		parseOptionalDate(entitlement?.grace_period_expires_date);
	const verifiedAt = Date.now();
	const activeDates = [expiresAt, graceExpiresAt].filter(
		(value): value is number => value !== undefined,
	);
	const activeThrough =
		activeDates.length > 0
			? Math.max(...activeDates)
			: entitlement
				? Number.POSITIVE_INFINITY
				: 0;
	const active = Boolean(entitlement && verifiedAt < activeThrough);

	return {
		active,
		snapshot: {
			active,
			...(expiresAt !== undefined ? { expiresAt } : {}),
			...(graceExpiresAt !== undefined ? { graceExpiresAt } : {}),
			...(productId ? { productId } : {}),
			...(subscription?.store ? { store: subscription.store } : {}),
			...(subscription
				? { willRenew: !subscription.unsubscribe_detected_at }
				: {}),
			...(subscription?.billing_issues_detected_at
				? {
						billingIssueDetectedAt: parseOptionalDate(
							subscription.billing_issues_detected_at,
						),
					}
				: {}),
			...(payload.subscriber.management_url
				? { managementUrl: payload.subscriber.management_url }
				: {}),
			verifiedAt,
		},
	};
};

const revenueCatSecretApiKey = () => {
	const value = env.REVENUECAT_SECRET_API_KEY?.trim();
	if (!value) {
		throwUserFacingError("RevenueCat ist noch nicht vollständig konfiguriert.");
	}
	return value;
};

export const syncSubscriberByAppUserId = internalAction({
	args: {
		appUserId: v.string(),
		ownerTokenIdentifier: v.string(),
	},
	handler: async (ctx, args) => {
		const result = await fetchSubscriberSnapshot(
			args.appUserId,
			revenueCatSecretApiKey(),
		);
		await ctx.runMutation(internal.entitlements.applyRevenueCatSnapshot, {
			ownerTokenIdentifier: args.ownerTokenIdentifier,
			...result.snapshot,
		});

		return { active: result.active };
	},
});

export const syncMyEntitlement = action({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throwUserFacingError("Nicht authentifiziert.");
		}

		const result = await fetchSubscriberSnapshot(
			identity.subject,
			revenueCatSecretApiKey(),
		);
		await ctx.runMutation(internal.entitlements.applyRevenueCatSnapshot, {
			ownerTokenIdentifier: identity.tokenIdentifier,
			...result.snapshot,
		});

		return { active: result.active };
	},
});
