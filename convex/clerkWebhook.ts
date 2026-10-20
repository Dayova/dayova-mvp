import { Webhook } from "svix";
import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";

const record = (value: unknown): Record<string, unknown> | null =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
const timestamp = (value: unknown): value is number =>
	typeof value === "number" && Number.isSafeInteger(value) && value > 0;

export function parseClerkUser(value: unknown) {
	const user = record(value);
	if (
		!user ||
		typeof user.id !== "string" ||
		!user.id.startsWith("user_") ||
		!timestamp(user.updated_at) ||
		!Array.isArray(user.email_addresses)
	) {
		throw new Error("Invalid Clerk user");
	}
	const primary = user.email_addresses
		.map(record)
		.find((email) => email?.id === user.primary_email_address_id);
	const verifiedEmail =
		record(primary?.verification)?.status === "verified" &&
		typeof primary?.email_address === "string" &&
		primary.email_address.trim()
			? primary.email_address.trim().toLowerCase()
			: undefined;
	return { clerkId: user.id, updatedAt: user.updated_at, verifiedEmail };
}

export const clerkWebhook = httpAction(async (ctx, request) => {
	const secret = env.CLERK_WEBHOOK_SIGNING_SECRET;
	const instanceId = env.CLERK_WEBHOOK_INSTANCE_ID;
	if (!secret || !instanceId || !env.CLERK_JWT_ISSUER_DOMAIN)
		return new Response("Webhook is not configured", { status: 503 });
	const body = await request.text();
	if (new TextEncoder().encode(body).length > 1024 * 1024)
		return new Response("Payload too large", { status: 413 });
	try {
		new Webhook(secret).verify(body, {
			"svix-id": request.headers.get("svix-id") ?? "",
			"svix-timestamp": request.headers.get("svix-timestamp") ?? "",
			"svix-signature": request.headers.get("svix-signature") ?? "",
		});
	} catch {
		return new Response("Invalid signature", { status: 401 });
	}
	let event: Record<string, unknown> | null;
	try {
		event = record(JSON.parse(body));
	} catch {
		event = null;
	}
	if (!event || event.object !== "event" || !timestamp(event.timestamp))
		return new Response("Invalid event", { status: 400 });
	if (event.instance_id !== instanceId)
		return new Response("Wrong Clerk instance", { status: 403 });
	if (
		!["user.created", "user.updated", "user.deleted"].includes(
			String(event.type),
		)
	)
		return new Response("Ignored", { status: 200 });
	let user: ReturnType<typeof parseClerkUser>;
	try {
		if (event.type === "user.deleted") {
			const data = record(event.data);
			if (
				typeof data?.id !== "string" ||
				!data.id.startsWith("user_") ||
				data.deleted !== true
			)
				throw new Error("Invalid deleted user");
			user = {
				clerkId: data.id,
				updatedAt: event.timestamp,
				verifiedEmail: undefined,
			};
		} else user = parseClerkUser(event.data);
	} catch {
		return new Response("Invalid user", { status: 400 });
	}
	try {
		await ctx.runMutation(internal.clerkLifecycle.apply, {
			...user,
			instanceId,
			eventAt: event.timestamp,
			deleted: event.type === "user.deleted",
		});
	} catch {
		// Do not acknowledge a failed transaction. Svix retries; never log the payload.
		return new Response("Lifecycle update unavailable", { status: 503 });
	}
	return new Response("OK", { status: 200 });
});
