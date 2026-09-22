/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { LoopsContact } from "./loopsClient";
import { LOOPS_STUDENT_LIST_ID } from "./loopsContract";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const listId = "isolated-test-list";
const identity = {
	subject: "user_student",
	tokenIdentifier: "issuer|user_student",
	email: "student@example.com",
	name: "New Student",
};
type Write = { path: string; body: Record<string, unknown> };
function mockLoops(initial: LoopsContact[] = []) {
	const contacts = [...initial];
	const writes: Write[] = [];
	const mock = vi.fn(async (url: string, init?: RequestInit) => {
		const parsed = new URL(url);
		const path = parsed.pathname;
		if (path.endsWith("/lists")) return Response.json([{ id: listId }]);
		if (path.endsWith("/find")) {
			const key = parsed.searchParams.has("userId") ? "userId" : "email";
			return Response.json(
				contacts.filter((c) => c[key] === parsed.searchParams.get(key)),
			);
		}
		const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
		writes.push({ path, body });
		if (path.endsWith("/delete")) {
			const index = contacts.findIndex((c) => c.userId === body.userId);
			if (index >= 0) contacts.splice(index, 1);
			return Response.json({ success: true });
		}
		if (path.endsWith("/create")) {
			if (
				contacts.some((c) => c.email === body.email || c.userId === body.userId)
			)
				return new Response(null, { status: 409 });
			contacts.push({
				id: `contact-${contacts.length}`,
				email: String(body.email),
				userId: String(body.userId),
				subscribed: true,
				mailingLists: body.mailingLists as Record<string, boolean>,
			});
		}
		const match = contacts.find((c) => c.userId === body.userId);
		return match
			? Response.json({ success: true, id: match.id })
			: new Response(null, { status: 400 });
	});
	vi.stubGlobal("fetch", mock);
	return { contacts, writes, mock };
}
function existing(overrides: Partial<LoopsContact> = {}): LoopsContact {
	return {
		id: "existing",
		email: identity.email,
		userId: identity.subject,
		subscribed: true,
		mailingLists: { [listId]: true },
		...overrides,
	};
}
async function setup() {
	vi.stubEnv("LOOPS_MODE", "off");
	vi.stubEnv("NOTION_CRM_MODE", "off");
	vi.stubEnv("LOOPS_API_KEY", "test-only");
	vi.stubEnv("LOOPS_STUDENT_LIST_ID", listId);
	const t = convexTest(schema, modules);
	const userId = await t
		.withIdentity(identity)
		.mutation(api.users.syncCurrentUser, {});
	const job = await t.run((ctx) => ctx.db.query("loopsStudents").first());
	if (!job) throw new Error("Expected signup job");
	return { t, userId, job };
}
async function deliver(t: Awaited<ReturnType<typeof setup>>["t"]) {
	vi.stubEnv("LOOPS_MODE", "live");
	return t.action(internal.loopsSync.reconcile, {});
}
async function clearBackoff(t: Awaited<ReturnType<typeof setup>>["t"]) {
	await t.run(async (ctx) => {
		const row = await ctx.db.query("loopsWorker").first();
		if (row) await ctx.db.patch("loopsWorker", row._id, { retryAt: 0 });
	});
}
afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

test("new authenticated accounts queue once while off; existing accounts do not backfill", async () => {
	const { t, job } = await setup();
	await t.withIdentity(identity).mutation(api.users.syncCurrentUser, {});
	expect(
		await t.run((ctx) => ctx.db.query("loopsStudents").take(5)),
	).toHaveLength(1);
	await t.run((ctx) => ctx.db.delete("loopsStudents", job._id));
	await t.withIdentity(identity).mutation(api.users.syncCurrentUser, {});
	expect(await t.run((ctx) => ctx.db.query("loopsStudents").take(5))).toEqual(
		[],
	);
});

test("live signup schedules Loops independently from disabled CRM without network I/O", async () => {
	vi.useFakeTimers();
	try {
		const { t } = await setup();
		vi.stubEnv("LOOPS_MODE", "live");
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		await t
			.withIdentity({
				...identity,
				subject: "second",
				tokenIdentifier: "issuer|second",
			})
			.mutation(api.users.syncCurrentUser, {});
		const scheduled = await t.run((ctx) =>
			ctx.db.system.query("_scheduled_functions").take(5),
		);
		expect(scheduled).toHaveLength(1);
		expect(scheduled[0].name).toContain("loopsSync");
		expect(fetchMock).not.toHaveBeenCalled();
		vi.stubEnv("LOOPS_MODE", "off");
		await t.finishAllScheduledFunctions(vi.runAllTimers);
	} finally {
		vi.useRealTimers();
	}
});

test("creates exactly one contact with canonical identity and configured list; dry-run never writes", async () => {
	const { t, job } = await setup();
	const remote = mockLoops();
	expect(await t.action(internal.loopsSync.reconcile, {})).toMatchObject({
		status: "disabled",
	});
	expect(
		await t.action(internal.loopsSync.reconcile, { dryRun: true }),
	).toMatchObject({ wouldSync: 1 });
	expect(remote.writes).toHaveLength(0);
	expect(
		await t.run((ctx) => ctx.db.get("loopsStudents", job._id)),
	).toMatchObject({ status: "pending" });
	expect(await deliver(t)).toMatchObject({ status: "complete", synced: 1 });
	expect(remote.writes[0]).toEqual({
		path: "/api/v1/contacts/create",
		body: {
			userId: identity.subject,
			email: identity.email,
			firstName: "New",
			lastName: "Student",
			source: "Dayova App",
			userGroup: "students",
			mailingLists: { [listId]: true },
		},
	});
	await deliver(t);
	expect(remote.writes).toHaveLength(1);
	expect(remote.writes[0].body.mailingLists).not.toHaveProperty(
		LOOPS_STUDENT_LIST_ID,
	);
});

test("onboarding name updates reuse the contact without changing subscriptions or lists", async () => {
	const { t } = await setup();
	const remote = mockLoops();
	await deliver(t);
	remote.contacts[0].subscribed = false;
	vi.stubEnv("LOOPS_MODE", "off");
	await t
		.withIdentity(identity)
		.mutation(api.users.updateProfile, { name: "Other Name" });
	await deliver(t);
	expect(remote.writes[1]).toEqual({
		path: "/api/v1/contacts/update",
		body: {
			userId: identity.subject,
			firstName: "Other",
			lastName: "Name",
		},
	});
	expect(remote.contacts[0].subscribed).toBe(false);
});

test("profile email input cannot change the authenticated recipient", async () => {
	const { t } = await setup();
	const remote = mockLoops();
	await t.withIdentity(identity).mutation(api.users.updateProfile, {
		email: "someone@example.com",
		name: "Changed",
	});
	await deliver(t);
	expect(remote.writes[0].body.email).toBe(identity.email);
});

test.each([
	["unlinked email", existing({ userId: null }), "identity_conflict"],
	[
		"another identity",
		existing({ userId: "someone_else" }),
		"identity_conflict",
	],
	["changed email", existing({ email: "older@example.com" }), "email_changed"],
	["list unsubscribe", existing({ mailingLists: {} }), "list_membership"],
] as const)("preserves %s and surfaces review without writes", async (_label, contact, error) => {
	const { t, job } = await setup();
	const remote = mockLoops([contact]);
	expect(await deliver(t)).toMatchObject({ failed: 1 });
	expect(remote.writes).toHaveLength(0);
	expect(
		await t.run((ctx) => ctx.db.get("loopsStudents", job._id)),
	).toMatchObject({ status: "review", error });
});

test("recovers a lost create response without a second create or list assignment", async () => {
	const { t, job } = await setup();
	const remote = mockLoops();
	const original = remote.mock.getMockImplementation();
	remote.mock.mockImplementation(async (url, init) => {
		const response = await original?.(url, init);
		if (url.endsWith("/create")) throw new Error("sensitive response detail");
		return response as Response;
	});
	await deliver(t);
	expect(remote.contacts).toHaveLength(1);
	await clearBackoff(t);
	await t.mutation(internal.loopsState.retry, { id: job._id });
	await deliver(t);
	expect(remote.writes.map((w) => w.path)).toEqual([
		"/api/v1/contacts/create",
		"/api/v1/contacts/update",
	]);
	expect(remote.writes[1].body).not.toHaveProperty("mailingLists");
});

test("uncertain create with no visible contact goes to review rather than blind retry", async () => {
	const { t, job } = await setup();
	const remote = mockLoops();
	const original = remote.mock.getMockImplementation();
	remote.mock.mockImplementation(async (url, init) => {
		if (url.endsWith("/create")) throw new Error("lost");
		return (await original?.(url, init)) as Response;
	});
	await deliver(t);
	await clearBackoff(t);
	await t.mutation(internal.loopsState.retry, { id: job._id });
	await deliver(t);
	expect(
		await t.run((ctx) => ctx.db.get("loopsStudents", job._id)),
	).toMatchObject({ status: "review", error: "uncertain_create" });
	expect(
		remote.mock.mock.calls.filter(([url]) => url.endsWith("/create")),
	).toHaveLength(1);
});

test("missing configuration and a missing list are visible and cannot write", async () => {
	const { t } = await setup();
	const remote = mockLoops();
	vi.stubEnv("LOOPS_API_KEY", "");
	expect(await deliver(t)).toMatchObject({
		status: "failed",
		error: "configuration",
	});
	expect(remote.mock).not.toHaveBeenCalled();
	vi.stubEnv("LOOPS_API_KEY", "test-only");
	vi.stubEnv("LOOPS_STUDENT_LIST_ID", "wrong-list");
	expect(await deliver(t)).toMatchObject({
		status: "failed",
		error: "configuration",
	});
	expect(remote.writes).toHaveLength(0);
	expect(await t.query(internal.loopsState.status, {})).toMatchObject({
		error: "configuration",
		leaseUntil: 0,
	});
});

test("single worker lease prevents concurrent creates and can recover after timeout", async () => {
	const { t } = await setup();
	const remote = mockLoops();
	expect(await t.mutation(internal.loopsState.begin, { runId: "owner" })).toBe(
		true,
	);
	expect(await deliver(t)).toMatchObject({ status: "busy" });
	expect(remote.mock).not.toHaveBeenCalled();
	await t.run(async (ctx) => {
		const row = await ctx.db.query("loopsWorker").first();
		if (row) await ctx.db.patch("loopsWorker", row._id, { leaseUntil: 0 });
	});
	expect(await deliver(t)).toMatchObject({ synced: 1 });
});

test("pending deletion never creates; a delivered contact is deleted without retaining email", async () => {
	const { t, job } = await setup();
	const remote = mockLoops();
	await t
		.withIdentity(identity)
		.mutation(api.accountDeletion.deleteCurrentUserDataBatch, {});
	await deliver(t);
	expect(remote.writes).toHaveLength(0);
	expect(await t.run((ctx) => ctx.db.get("loopsStudents", job._id))).toBeNull();
	const next = await setup();
	await deliver(next.t);
	vi.stubEnv("LOOPS_MODE", "off");
	await next.t
		.withIdentity(identity)
		.mutation(api.accountDeletion.deleteCurrentUserDataBatch, {});
	expect(
		await next.t.run((ctx) => ctx.db.get("loopsStudents", next.job._id)),
	).toMatchObject({ deleted: true, status: "pending" });
	expect(
		await next.t.run((ctx) => ctx.db.get("loopsStudents", next.job._id)),
	).not.toHaveProperty("accountEmail");
	await deliver(next.t);
	expect(remote.contacts).toHaveLength(0);
	expect(
		await next.t.run((ctx) => ctx.db.get("loopsStudents", next.job._id)),
	).toBeNull();
});

test("profile edits during a create remain pending and are delivered afterward", async () => {
	const { t, job } = await setup();
	const remote = mockLoops();
	const original = remote.mock.getMockImplementation();
	let changed = false;
	remote.mock.mockImplementation(async (url, init) => {
		if (url.endsWith("/create") && !changed) {
			changed = true;
			vi.stubEnv("LOOPS_MODE", "off");
			await t
				.withIdentity(identity)
				.mutation(api.users.updateProfile, { name: "Latest Name" });
			vi.stubEnv("LOOPS_MODE", "live");
		}
		return (await original?.(url, init)) as Response;
	});
	await deliver(t);
	expect(
		await t.run((ctx) => ctx.db.get("loopsStudents", job._id)),
	).toMatchObject({ status: "pending", version: 2 });
	await deliver(t);
	expect(remote.writes[1].body.firstName).toBe("Latest");
});

test("throttling pauses the whole worker and honors Retry-After without leaking provider detail", async () => {
	const { t, job } = await setup();
	const remote = mockLoops();
	const original = remote.mock.getMockImplementation();
	remote.mock.mockImplementation(async (url, init) => {
		if (url.includes("/find"))
			return new Response("private data", {
				status: 429,
				headers: { "Retry-After": "600" },
			});
		return (await original?.(url, init)) as Response;
	});
	const before = Date.now();
	expect(await deliver(t)).toMatchObject({
		status: "failed",
		error: "rate_limited",
	});
	const stored = await t.run((ctx) => ctx.db.get("loopsStudents", job._id));
	expect(stored?.nextAttemptAt).toBeGreaterThanOrEqual(before + 600_000);
	expect(stored?.error).toBe("rate_limited");
	const count = remote.mock.mock.calls.length;
	expect(await deliver(t)).toMatchObject({ status: "busy" });
	expect(remote.mock).toHaveBeenCalledTimes(count);
});

test("destination changes never move a previously attempted contact into another list", async () => {
	const { t, job } = await setup();
	const remote = mockLoops();
	await deliver(t);
	await t.mutation(internal.loopsState.retry, { id: job._id });
	vi.stubEnv("LOOPS_STUDENT_LIST_ID", "new-destination");
	const original = remote.mock.getMockImplementation();
	remote.mock.mockImplementation(async (url, init) =>
		url.endsWith("/lists")
			? Response.json([{ id: "new-destination" }])
			: ((await original?.(url, init)) as Response),
	);
	expect(await deliver(t)).toMatchObject({ failed: 1 });
	expect(remote.writes).toHaveLength(1);
	expect(
		await t.run((ctx) => ctx.db.get("loopsStudents", job._id)),
	).toMatchObject({ error: "destination_changed", status: "review" });
});

test("account deletion racing a create leaves cleanup pending and deletes the new contact", async () => {
	const { t, job } = await setup();
	const remote = mockLoops();
	const original = remote.mock.getMockImplementation();
	remote.mock.mockImplementation(async (url, init) => {
		if (url.endsWith("/create")) {
			vi.stubEnv("LOOPS_MODE", "off");
			await t
				.withIdentity(identity)
				.mutation(api.accountDeletion.deleteCurrentUserDataBatch, {});
			vi.stubEnv("LOOPS_MODE", "live");
		}
		return (await original?.(url, init)) as Response;
	});
	await deliver(t);
	expect(
		await t.run((ctx) => ctx.db.get("loopsStudents", job._id)),
	).toMatchObject({ deleted: true, status: "pending", contactId: "contact-0" });
	await deliver(t);
	expect(remote.contacts).toHaveLength(0);
});

test("shortened names clear stale last names; a deleted remote contact is not recreated", async () => {
	const { t, job } = await setup();
	const remote = mockLoops();
	await deliver(t);
	vi.stubEnv("LOOPS_MODE", "off");
	await t
		.withIdentity(identity)
		.mutation(api.users.updateProfile, { name: "Alex" });
	await deliver(t);
	expect(remote.writes[1].body).toMatchObject({
		firstName: "Alex",
		lastName: "",
	});
	remote.contacts.splice(0);
	await t.mutation(internal.loopsState.retry, { id: job._id });
	await deliver(t);
	expect(remote.writes).toHaveLength(2);
	expect(
		await t.run((ctx) => ctx.db.get("loopsStudents", job._id)),
	).toMatchObject({ error: "contact_missing" });
});

test("invalid provider responses and internal accounts fail closed", async () => {
	const { t, userId, job } = await setup();
	const remote = mockLoops();
	const original = remote.mock.getMockImplementation();
	remote.mock.mockImplementation(async (url, init) =>
		url.includes("/find")
			? Response.json([{ id: "incomplete" }])
			: ((await original?.(url, init)) as Response),
	);
	await deliver(t);
	expect(remote.writes).toHaveLength(0);
	expect(
		await t.run((ctx) => ctx.db.get("loopsStudents", job._id)),
	).toMatchObject({ status: "review", error: "invalid_response" });
	await t.run((ctx) =>
		ctx.db.patch("users", userId, { validationRole: "founder" }),
	);
	await t.mutation(internal.loopsState.retry, { id: job._id });
	mockLoops();
	await deliver(t);
	expect(
		await t.run((ctx) => ctx.db.get("loopsStudents", job._id)),
	).toMatchObject({ error: "internal_account" });
});

test("repairing an account-wide authorization failure automatically resumes pending contacts", async () => {
	const { t, job } = await setup();
	const remote = mockLoops();
	const original = remote.mock.getMockImplementation();
	remote.mock.mockImplementation(async (url, init) =>
		url.includes("/find")
			? new Response(null, { status: 401 })
			: ((await original?.(url, init)) as Response),
	);
	expect(await deliver(t)).toMatchObject({ error: "unauthorized" });
	expect(
		await t.run((ctx) => ctx.db.get("loopsStudents", job._id)),
	).toMatchObject({ status: "pending" });
	mockLoops();
	expect(await deliver(t)).toMatchObject({ synced: 1 });
});

test("an identity duplicate arriving during provider lookup prevents the outbound write", async () => {
	const { t, job } = await setup();
	const remote = mockLoops();
	const original = remote.mock.getMockImplementation();
	let added = false;
	remote.mock.mockImplementation(async (url, init) => {
		if (url.includes("?email=") && !added) {
			added = true;
			await t.run((ctx) =>
				ctx.db.insert("users", {
					tokenIdentifier: "other-issuer|user_student",
					clerkId: identity.subject,
					email: "duplicate@example.com",
				}),
			);
		}
		return (await original?.(url, init)) as Response;
	});
	expect(await deliver(t)).toMatchObject({ skipped: 1 });
	expect(remote.writes).toHaveLength(0);
	await deliver(t);
	expect(
		await t.run((ctx) => ctx.db.get("loopsStudents", job._id)),
	).toMatchObject({ error: "identity_conflict", status: "review" });
});

test("a failed deletion acknowledgement retains the tombstone for retry", async () => {
	const { t, job } = await setup();
	mockLoops();
	await deliver(t);
	vi.stubEnv("LOOPS_MODE", "off");
	await t
		.withIdentity(identity)
		.mutation(api.accountDeletion.deleteCurrentUserDataBatch, {});
	await t.mutation(internal.loopsState.finish, {
		id: job._id,
		version: job.version + 1,
		deleted: true,
		error: "unavailable",
		retryAt: Date.now() + 60_000,
	});
	expect(
		await t.run((ctx) => ctx.db.get("loopsStudents", job._id)),
	).toMatchObject({ deleted: true, status: "pending", error: "unavailable" });
});
