import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { Webhook } from "svix";

// Run with `convex dev` running in a separate terminal. Never targets cloud data.
const localEnv = readFileSync(".env.local", "utf8");
const deployment = localEnv.match(
	/^CONVEX_DEPLOYMENT=((?:local|anonymous):\S+)/m,
)?.[1];
assert.ok(deployment, "A local or anonymous Convex deployment is required");
const site = localEnv.match(/^EXPO_PUBLIC_CONVEX_SITE_URL=(\S+)/m)?.[1];
assert.ok(site && new URL(site).hostname === "127.0.0.1");

function cli(args, options = {}) {
	const result = spawnSync(
		process.execPath,
		[
			"./node_modules/convex/bin/main.js",
			...args,
			...(deployment.startsWith("anonymous:") ? [] : ["--deployment", "local"]),
		],
		{
			encoding: "utf8",
			input: options.input,
			env: {
				...process.env,
				CONVEX_DEPLOYMENT: deployment,
				CONVEX_DEPLOY_KEY: "",
				CONVEX_SELF_HOSTED_URL: "",
				CONVEX_SELF_HOSTED_ADMIN_KEY: "",
			},
		},
	);
	if (!options.allowFailure)
		assert.equal(result.status, 0, `Local Convex ${args[0]} failed`);
	return result;
}

const issuer = cli(["env", "get", "CLERK_JWT_ISSUER_DOMAIN"]).stdout.trim();
assert.ok(issuer.startsWith("https://"));
const secret = `whsec_${randomBytes(32).toString("base64")}`;
cli(["env", "set", "CLERK_WEBHOOK_SIGNING_SECRET"], { input: secret });
cli(["env", "set", "CLERK_WEBHOOK_INSTANCE_ID", "ins_local_lifecycle_smoke"]);
const subject = `user_local_lifecycle_smoke_${Date.now()}`;
const identity = JSON.stringify({
	issuer,
	subject,
	email: "before+lifecycle-smoke@example.com",
});
const asUser = (name, allowFailure = false) =>
	cli(["run", name, "{}", "--identity", identity], { allowFailure });
asUser("users:syncCurrentUser");
const now = Date.now();
const event = {
	object: "event",
	type: "user.updated",
	instance_id: "ins_local_lifecycle_smoke",
	timestamp: now,
	data: {
		id: subject,
		updated_at: now,
		primary_email_address_id: "idn_smoke",
		email_addresses: [
			{
				id: "idn_smoke",
				email_address: "after+lifecycle-smoke@example.com",
				verification: { status: "verified" },
			},
		],
	},
};
async function send(payload, forged = false) {
	const body = JSON.stringify(payload),
		id = `msg_${randomBytes(8).toString("hex")}`,
		time = new Date();
	return fetch(`${site}/clerk-webhook`, {
		method: "POST",
		body,
		headers: {
			"svix-id": id,
			"svix-timestamp": String(Math.floor(time.getTime() / 1000)),
			"svix-signature": forged
				? "v1,invalid"
				: new Webhook(secret).sign(id, time, body),
		},
	});
}
const valid = (await send(event)).status;
const forged = (await send(event, true)).status;
const foreignInstance = (await send({ ...event, instance_id: "ins_foreign" }))
	.status;
assert.equal(valid, 200);
assert.equal(forged, 401);
assert.equal(foreignInstance, 403);
asUser("users:syncCurrentUser");
assert.equal(
	JSON.parse(asUser("users:getMe").stdout).email,
	"after+lifecycle-smoke@example.com",
);
await send({
	...event,
	data: {
		...event.data,
		updated_at: now - 1,
		email_addresses: [
			{
				...event.data.email_addresses[0],
				email_address: "stale+lifecycle-smoke@example.com",
			},
		],
	},
});
assert.equal(
	JSON.parse(asUser("users:getMe").stdout).email,
	"after+lifecycle-smoke@example.com",
);
const deleted = (
	await send({
		...event,
		type: "user.deleted",
		timestamp: Date.now(),
		data: { id: subject, object: "user", deleted: true },
	})
).status;
assert.equal(deleted, 200);
assert.notEqual(asUser("users:syncCurrentUser", true).status, 0);
console.log(
	JSON.stringify(
		{
			deployment: "isolated local backend",
			validWebhook: valid,
			forgedWebhook: forged,
			foreignInstance,
			staleJwtPreservesEmail: true,
			staleEventIgnored: true,
			deletionWebhook: deleted,
			deletedAccountCannotResync: true,
			productionTouched: false,
		},
		null,
		2,
	),
);
