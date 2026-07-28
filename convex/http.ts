import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
	path: "/revenuecat-webhook",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const expectedAuthorization = env.REVENUECAT_WEBHOOK_AUTHORIZATION?.trim();
		if (!expectedAuthorization) {
			return new Response("Webhook is not configured", { status: 503 });
		}
		if (request.headers.get("authorization") !== expectedAuthorization) {
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

		await ctx.runAction(internal.revenueCat.syncSubscriberByAppUserId, {
			appUserId,
			ownerTokenIdentifier,
		});

		return new Response("OK", { status: 200 });
	}),
});

export default http;
