/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { Webhook } from "svix";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { DELETION_REPLAY_RETENTION_MS } from "./clerkIdentity";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const issuer = "https://clerk.lifecycle.test";
const instanceId = "ins_lifecycle_test";
const secret = "whsec_dGVzdC1zaWduaW5nLWtleS1vbmx5";
const identity = {
	issuer,
	subject: "user_lifecycle",
	tokenIdentifier: `${issuer}|user_lifecycle`,
	email: "old@example.com",
};
beforeEach(() => {
	// Ordering fixtures use millisecond timestamps near the epoch.
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(60_000);
	vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", issuer);
	vi.stubEnv("CLERK_WEBHOOK_INSTANCE_ID", instanceId);
	vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", secret);
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});
const update = (
	updatedAt: number,
	eventAt = updatedAt,
	verifiedEmail = "new@example.com",
) => ({
	instanceId,
	clerkId: identity.subject,
	updatedAt,
	eventAt,
	verifiedEmail,
	deleted: false,
});
const clerkUser = (
	updatedAt: number,
	email = "new@example.com",
	verified = true,
) => ({
	id: identity.subject,
	updated_at: updatedAt,
	primary_email_address_id: "idn_primary",
	email_addresses: [
		{
			id: "idn_other",
			email_address: "secondary@example.com",
			verification: { status: "verified" },
		},
		{
			id: "idn_primary",
			email_address: email,
			verification: { status: verified ? "verified" : "unverified" },
		},
	],
});
const signed = (payload: unknown, timestamp = new Date()) => {
	const body = JSON.stringify(payload),
		id = "msg_lifecycle_test";
	return {
		method: "POST",
		body,
		headers: {
			"svix-id": id,
			"svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
			"svix-signature": new Webhook(secret).sign(id, timestamp, body),
		},
	};
};

test("audit expiry preserves access denial until barrier expiry, then rejects freshly signed old events", async () => {
	const t = convexTest(schema, modules);
	const user = t.withIdentity(identity);
	const accepted = await user.mutation(
		internal.accountDeletion.enqueueVerifiedDeletion,
		{},
	);
	await t.run(async (ctx) => {
		const request = await ctx.db.query("accountDeletionRequests").unique();
		if (!request) throw new Error("Missing request");
		await ctx.db.patch("accountDeletionRequests", request._id, {
			stage: "deleteNotion",
			crmDeletionVerified: true,
		});
	});
	const completedAt = Date.now();
	expect(
		await t.mutation(internal.accountDeletion.completeRequest, {
			requestId: accepted.requestId,
		}),
	).toBe(true);
	expect(
		await t.run((ctx) => ctx.db.query("clerkIdentities").unique()),
	).toMatchObject({
		deletionCompletedAt: completedAt,
	});
	vi.setSystemTime(completedAt + 30 * 24 * 60 * 60 * 1000);
	expect(
		await t.mutation(internal.accountDeletion.purgeCompletedAudits, {}),
	).toBe(1);
	await expect(user.mutation(api.users.syncCurrentUser, {})).rejects.toThrow(
		"dauerhaft gelöscht",
	);
	vi.setSystemTime(completedAt + DELETION_REPLAY_RETENTION_MS - 1);
	expect(
		await t.mutation(internal.clerkLifecycle.purgeExpiredDeletionBarriers, {}),
	).toBe(0);
	vi.setSystemTime(completedAt + DELETION_REPLAY_RETENTION_MS);
	expect(
		await t.mutation(internal.clerkLifecycle.purgeExpiredDeletionBarriers, {}),
	).toBe(1);
	for (const type of ["user.created", "user.updated", "user.deleted"]) {
		const response = await t.fetch(
			"/clerk-webhook",
			signed({
				object: "event",
				instance_id: instanceId,
				type,
				timestamp: completedAt,
				data:
					type === "user.deleted"
						? { id: identity.subject, deleted: true }
						: clerkUser(completedAt),
			}),
		);
		expect(response.status).toBe(200);
	}
	expect(
		await t.run((ctx) => ctx.db.query("clerkIdentities").take(10)),
	).toEqual([]);
	expect(await t.run((ctx) => ctx.db.query("users").take(10))).toEqual([]);
	expect(
		await t.run((ctx) => ctx.db.query("accountDeletionRequests").take(10)),
	).toEqual([]);
	// A genuinely new identity and current event remain eligible.
	expect(
		await t.mutation(internal.clerkLifecycle.apply, {
			...update(Date.now()),
			clerkId: "user_replacement",
		}),
	).toBe("applied");
});

test("unresolved deletion barriers and active identities do not expire", async () => {
	const t = convexTest(schema, modules);
	await t
		.withIdentity(identity)
		.mutation(internal.accountDeletion.enqueueVerifiedDeletion, {});
	await t.mutation(internal.clerkLifecycle.apply, {
		...update(Date.now()),
		clerkId: "user_active",
	});
	vi.setSystemTime(Date.now() + 2 * DELETION_REPLAY_RETENTION_MS);
	expect(
		await t.mutation(internal.clerkLifecycle.purgeExpiredDeletionBarriers, {}),
	).toBe(0);
	expect(
		await t.mutation(internal.accountDeletion.purgeCompletedAudits, {}),
	).toBe(0);
	expect(
		await t.run((ctx) => ctx.db.query("clerkIdentities").take(10)),
	).toHaveLength(2);
	await expect(
		t.withIdentity(identity).mutation(api.users.syncCurrentUser, {}),
	).rejects.toThrow("dauerhaft gelöscht");
});

test("expires completed replay barriers in bounded idempotent batches", async () => {
	const t = convexTest(schema, modules);
	await t.run(async (ctx) => {
		for (let index = 0; index < 101; index++) {
			await ctx.db.insert("clerkIdentities", {
				tokenIdentifier: `${issuer}|user_${index}`,
				clerkId: `user_${index}`,
				updatedAt: 1,
				eventAt: 1,
				deletedAt: 1,
				deletionCompletedAt: 2,
			});
		}
	});
	vi.setSystemTime(DELETION_REPLAY_RETENTION_MS + 2);
	expect(
		await t.mutation(internal.clerkLifecycle.purgeExpiredDeletionBarriers, {}),
	).toBe(100);
	expect(
		await t.mutation(internal.clerkLifecycle.purgeExpiredDeletionBarriers, {}),
	).toBe(1);
	expect(
		await t.mutation(internal.clerkLifecycle.purgeExpiredDeletionBarriers, {}),
	).toBe(0);
});

test("signed HTTP webhook selects the verified primary and updates the same app user", async () => {
	const t = convexTest(schema, modules),
		user = t.withIdentity(identity);
	const id = await user.mutation(api.users.syncCurrentUser, {
		name: "Preserved",
	});
	const response = await t.fetch(
		"/clerk-webhook",
		signed({
			object: "event",
			instance_id: instanceId,
			type: "user.updated",
			timestamp: 1001,
			data: clerkUser(1000),
		}),
	);
	expect(response.status).toBe(200);
	const rows = await t.run((ctx) => ctx.db.query("users").take(10));
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({
		_id: id,
		email: "new@example.com",
		name: "Preserved",
	});
	// A pre-webhook token and repeated sign-in must not restore the previous address.
	await user.mutation(api.users.syncCurrentUser, {});
	expect((await user.query(api.users.getMe, {}))?.email).toBe(
		"new@example.com",
	);
});

test("rejects forged, expired, wrong-instance and malformed events without writes", async () => {
	const t = convexTest(schema, modules);
	const event = {
		object: "event",
		instance_id: instanceId,
		type: "user.updated",
		timestamp: 1001,
		data: clerkUser(1000),
	};
	const forged = signed(event);
	forged.headers["svix-signature"] = "v1,invalid";
	expect((await t.fetch("/clerk-webhook", forged)).status).toBe(401);
	expect(
		(
			await t.fetch(
				"/clerk-webhook",
				signed(event, new Date(Date.now() - 600_000)),
			)
		).status,
	).toBe(401);
	expect(
		(
			await t.fetch(
				"/clerk-webhook",
				signed({ ...event, instance_id: "ins_other" }),
			)
		).status,
	).toBe(403);
	expect(
		(
			await t.fetch(
				"/clerk-webhook",
				signed({ ...event, data: { id: identity.subject } }),
			)
		).status,
	).toBe(400);
	expect(
		await t.run((ctx) => ctx.db.query("clerkIdentities").take(10)),
	).toEqual([]);
});

test("event ordering uses object version then event time; duplicates have no side effects", async () => {
	const t = convexTest(schema, modules),
		user = t.withIdentity(identity);
	await user.mutation(api.users.syncCurrentUser, {});
	await t.mutation(internal.clerkLifecycle.apply, update(2000, 3000));
	expect(
		await t.mutation(
			internal.clerkLifecycle.apply,
			update(1000, 4000, "stale@example.com"),
		),
	).toBe("ignored");
	expect(
		await t.mutation(
			internal.clerkLifecycle.apply,
			update(2000, 2999, "stale@example.com"),
		),
	).toBe("ignored");
	expect(
		await t.mutation(internal.clerkLifecycle.apply, update(2000, 3000)),
	).toBe("ignored");
	await t.mutation(
		internal.clerkLifecycle.apply,
		update(2000, 3001, "latest@example.com"),
	);
	expect((await user.query(api.users.getMe, {}))?.email).toBe(
		"latest@example.com",
	);
});

test("a webhook before first sign-in does not bypass app signup and onboarding", async () => {
	const t = convexTest(schema, modules);
	await t.mutation(internal.clerkLifecycle.apply, update(1000));
	expect(await t.run((ctx) => ctx.db.query("users").take(10))).toEqual([]);
	const user = t.withIdentity(identity);
	await user.mutation(api.users.syncCurrentUser, {});
	expect((await user.query(api.users.getMe, {}))?.email).toBe(
		"new@example.com",
	);
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentSignups").take(10)),
	).toHaveLength(1);
});

test("an unverified primary is never replaced by a secondary address or a cached JWT", async () => {
	const t = convexTest(schema, modules),
		user = t.withIdentity(identity);
	await user.mutation(api.users.syncCurrentUser, {});
	const response = await t.fetch(
		"/clerk-webhook",
		signed({
			object: "event",
			instance_id: instanceId,
			type: "user.updated",
			timestamp: 1001,
			data: clerkUser(1000, "unverified@example.com", false),
		}),
	);
	expect(response.status).toBe(200);
	expect((await user.query(api.users.getMe, {}))?.email).toBe("");
	await expect(user.mutation(api.users.syncCurrentUser, {})).rejects.toThrow(
		"E-Mail-Adresse",
	);
});

test("verified deletion blocks writes immediately and survives data deletion and late updates", async () => {
	const t = convexTest(schema, modules),
		user = t.withIdentity(identity);
	await user.mutation(api.users.syncCurrentUser, {});
	const event = {
		object: "event",
		instance_id: instanceId,
		type: "user.deleted",
		timestamp: 2000,
		data: { id: identity.subject, deleted: true, object: "user" },
	};
	expect((await t.fetch("/clerk-webhook", signed(event))).status).toBe(200);
	expect((await t.fetch("/clerk-webhook", signed(event))).status).toBe(200);
	await expect(user.mutation(api.users.syncCurrentUser, {})).rejects.toThrow(
		"dauerhaft gelöscht",
	);
	expect(await t.mutation(internal.clerkLifecycle.apply, update(3000))).toBe(
		"ignored",
	);
	const requests = await t.run((ctx) =>
		ctx.db.query("accountDeletionRequests").take(10),
	);
	expect(requests).toHaveLength(1);
	expect(requests[0]).toMatchObject({
		stage: "deleteRevenueCat",
		clerkStatus: "completed",
	});
	await t.run((ctx) =>
		ctx.db.patch("accountDeletionRequests", requests[0]._id, {
			stage: "deleteData",
		}),
	);
	let done = false;
	for (let batch = 0; batch < 10 && !done; batch++) {
		({ done } = await t.mutation(
			internal.accountDeletion.deleteOwnerDataBatch,
			{ requestId: requests[0].requestId },
		));
	}
	expect(done).toBe(true);
	await expect(user.mutation(api.users.syncCurrentUser, {})).rejects.toThrow(
		"dauerhaft gelöscht",
	);
	const barrier = await t.run((ctx) =>
		ctx.db.query("clerkIdentities").unique(),
	);
	expect(barrier).toMatchObject({ deletedAt: 2000 });
	expect(barrier).not.toHaveProperty("verifiedEmail");
	// Same email, new Clerk identity: a distinct account, never a merge.
	const replacement = t.withIdentity({
		...identity,
		subject: "user_replacement",
		tokenIdentifier: `${issuer}|user_replacement`,
	});
	await replacement.mutation(api.users.syncCurrentUser, {});
	expect((await replacement.query(api.users.getMe, {}))?.clerkId).toBe(
		"user_replacement",
	);
});

test("email webhook enqueues the existing CRM delivery path", async () => {
	vi.stubEnv("NOTION_CRM_MODE", "live");
	const t = convexTest(schema, modules),
		user = t.withIdentity(identity);
	const id = await user.mutation(api.users.syncCurrentUser, {});
	await t.mutation(internal.clerkLifecycle.apply, update(1000));
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentUpdates").take(10)),
	).toMatchObject([{ userId: id, status: "pending" }]);
});

test("provider deletion unblocks an app deletion already waiting on Clerk", async () => {
	const t = convexTest(schema, modules),
		user = t.withIdentity(identity);
	await user.mutation(api.users.syncCurrentUser, {});
	await user.mutation(internal.accountDeletion.enqueueVerifiedDeletion, {});
	await t.mutation(internal.clerkLifecycle.apply, {
		...update(Date.now()),
		deleted: true,
	});
	const requests = await t.run((ctx) =>
		ctx.db.query("accountDeletionRequests").take(10),
	);
	expect(requests).toHaveLength(1);
	expect(requests[0]).toMatchObject({
		stage: "deleteRevenueCat",
		clerkStatus: "completed",
	});
});

test("reconciliation is read-only by default and checks the API key's instance", async () => {
	vi.stubEnv("CLERK_SECRET_KEY", "test-only");
	const t = convexTest(schema, modules),
		user = t.withIdentity(identity);
	await user.mutation(api.users.syncCurrentUser, {});
	await t.run((ctx) =>
		ctx.db.insert("users", {
			tokenIdentifier: "https://other-instance.test|user_foreign",
			clerkId: "user_foreign",
			email: "foreign@example.com",
		}),
	);
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string) =>
			url.endsWith("/instance")
				? Response.json({ id: instanceId })
				: new Response(null, { status: 404 }),
		),
	);
	expect(
		await t.action(internal.clerkReconciliation.reconcileAccount, {
			clerkId: identity.subject,
		}),
	).toBe("missing");
	expect(
		await t.run((ctx) => ctx.db.query("accountDeletionRequests").take(10)),
	).toEqual([]);
	const audit = await t.action(internal.clerkReconciliation.audit, {
		paginationOpts: { numItems: 10, cursor: null },
	});
	expect(audit).toMatchObject({
		checked: 1,
		missing: [identity.subject],
		isDone: true,
	});
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => Response.json({ id: "ins_wrong" })),
	);
	await expect(
		t.action(internal.clerkReconciliation.reconcileAccount, {
			clerkId: identity.subject,
			dryRun: false,
		}),
	).rejects.toThrow("another instance");
	expect(
		await t.run((ctx) => ctx.db.query("accountDeletionRequests").take(10)),
	).toEqual([]);
});

test("Clerk outages are not treated as deleted accounts; explicit confirmed repair uses the same lifecycle", async () => {
	vi.stubEnv("CLERK_SECRET_KEY", "test-only");
	const t = convexTest(schema, modules);
	const http = vi.fn(async (url: string) =>
		url.endsWith("/instance")
			? Response.json({ id: instanceId })
			: new Response(null, { status: 503 }),
	);
	vi.stubGlobal("fetch", http);
	await expect(
		t.action(internal.clerkReconciliation.reconcileAccount, {
			clerkId: identity.subject,
			dryRun: false,
		}),
	).rejects.toThrow("503");
	expect(
		await t.run((ctx) => ctx.db.query("clerkIdentities").take(10)),
	).toEqual([]);
	http.mockImplementation(async (url: string) =>
		url.endsWith("/instance")
			? Response.json({ id: instanceId })
			: new Response(null, { status: 404 }),
	);
	expect(
		await t.action(internal.clerkReconciliation.reconcileAccount, {
			clerkId: identity.subject,
			dryRun: false,
		}),
	).toBe("applied");
	expect(
		await t.run((ctx) => ctx.db.query("accountDeletionRequests").take(10)),
	).toMatchObject([{ stage: "deleteRevenueCat" }]);
});
