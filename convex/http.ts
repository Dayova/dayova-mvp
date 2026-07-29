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
		const appUserId =
			typeof event === "object" &&
			event !== null &&
			"app_user_id" in event &&
			typeof event.app_user_id === "string"
				? event.app_user_id
				: null;
		if (!appUserId) {
			return new Response("Missing event.app_user_id", { status: 400 });
		}

		const ownerTokenIdentifier = await ctx.runQuery(
			internal.entitlements.findOwnerTokenIdentifierByClerkId,
			{ clerkId: appUserId },
		);
		if (!ownerTokenIdentifier) {
			return new Response("Subscriber not linked to a Dayova account", {
				status: 202,
			});
		}

		try {
			await ctx.runAction(internal.revenueCat.syncSubscriberByAppUserId, {
				appUserId,
				ownerTokenIdentifier,
			});
		} catch (error) {
			logDiagnosticError("revenueCat.webhook", error, { appUserId });
			return new Response("Subscriber sync unavailable", { status: 503 });
		}

		return new Response("OK", { status: 200 });
	}),
});

export default http;
