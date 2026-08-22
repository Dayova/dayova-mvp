import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";
import { logDiagnosticError } from "./errors";

const http = httpRouter();

const timingSafeEqual = (left: string, right: string) => {
	if (left.length !== right.length) return false;

	let mismatch = 0;
	for (let index = 0; index < left.length; index += 1) {
		mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return mismatch === 0;
};

const MAX_WEBHOOK_IDENTITY_CANDIDATES = 20;

const getString = (value: unknown) =>
	typeof value === "string" && value.length > 0 ? value : null;

const getStringArray = (value: unknown) => {
	if (!Array.isArray(value)) return [];

	const strings: string[] = [];
	for (const candidate of value) {
		if (typeof candidate === "string" && candidate.length > 0) {
			strings.push(candidate);
			if (strings.length === MAX_WEBHOOK_IDENTITY_CANDIDATES) break;
		}
	}
	return strings;
};

const getAppUserIdCandidates = (event: Record<string, unknown>) => {
	const candidates = [
		getString(event.app_user_id),
		...getStringArray(event.redeemed_by),
		...getStringArray(event.transferred_to),
		...getStringArray(event.transferred_from),
		...getStringArray(event.redeemed_from),
		...getStringArray(event.aliases),
		getString(event.original_app_user_id),
	].filter((candidate): candidate is string => candidate !== null);

	return [...new Set(candidates)].slice(0, MAX_WEBHOOK_IDENTITY_CANDIDATES);
};

http.route({
	path: "/revenuecat-webhook",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const expectedAuthorization = env.REVENUECAT_WEBHOOK_AUTHORIZATION?.trim();
		if (!expectedAuthorization) {
			return new Response("Webhook is not configured", { status: 503 });
		}
		const providedAuthorization =
			request.headers.get("authorization")?.trim() ?? "";
		if (!timingSafeEqual(providedAuthorization, expectedAuthorization)) {
			return new Response("Unauthorized", { status: 401 });
		}

		let payload: unknown;
		try {
			payload = await request.json();
		} catch {
			return new Response("Invalid JSON", { status: 400 });
		}

		const event =
			typeof payload === "object" && payload !== null && "event" in payload
				? payload.event
				: null;
		if (typeof event !== "object" || event === null) {
			return new Response("Missing event", { status: 400 });
		}
		const appUserIds = getAppUserIdCandidates(event as Record<string, unknown>);
		if (appUserIds.length === 0) {
			return new Response("No Dayova account identity in event", {
				status: 202,
			});
		}

		const owners = await ctx.runQuery(
			internal.entitlements.findOwnersByClerkIds,
			{ clerkIds: appUserIds },
		);
		if (owners.length === 0) {
			return new Response("Subscriber not linked to a Dayova account", {
				status: 202,
			});
		}

		try {
			for (const owner of owners) {
				await ctx.runAction(internal.revenueCat.syncSubscriberByAppUserId, {
					appUserId: owner.clerkId,
					ownerTokenIdentifier: owner.ownerTokenIdentifier,
				});
			}
		} catch (error) {
			logDiagnosticError("revenueCat.webhook", error, { appUserIds });
			return new Response("Subscriber sync unavailable", { status: 503 });
		}

		return new Response("OK", { status: 200 });
	}),
});

export default http;
