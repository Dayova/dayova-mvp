/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { CRM_PROPERTIES } from "./crmNotion";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const source = "d6268034-4ccc-4158-b82f-8f32d97bf401";
const pageId = "11111111-1111-4111-8111-111111111111";
const identity = {
	subject: "user_new",
	tokenIdentifier: "issuer|user_new",
	email: "new@example.com",
	name: "New Student",
};
type Row = {
	id: string;
	archived: boolean;
	parent: { data_source_id: string };
	properties: Record<string, unknown>;
};
function row(clerkId = identity.subject, email = identity.email): Row {
	return {
		id: pageId,
		archived: false,
		parent: { data_source_id: source },
		properties: {
			"Clerk User ID": {
				type: "rich_text",
				rich_text: [{ text: { content: clerkId } }],
			},
			Email: { email },
		},
	};
}
function mockNotion(
	rows: Row[] = [],
	failure?: "lost" | "unavailable" | "forbidden",
) {
	const creates: Array<{ properties: Record<string, unknown> }> = [];
	const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
		const body = init?.body ? JSON.parse(String(init.body)) : {};
		if (url.endsWith("/pages") && init?.method === "POST") {
			creates.push(body);
			if (failure === "forbidden") return new Response(null, { status: 403 });
			if (failure !== "unavailable")
				rows.push({
					...row(),
					properties: {
						...body.properties,
						"Clerk User ID": {
							type: "rich_text",
							...body.properties["Clerk User ID"],
						},
					},
				});
			if (failure === "lost" || failure === "unavailable")
				throw new Error("private provider detail");
			return Response.json(rows[rows.length - 1]);
		}
		if (url.endsWith("/query")) {
			const filtered = rows.filter((entry) => {
				if (!body.filter) return true;
				if (body.filter.email)
					return (
						(
							entry.properties.Email as { email: string }
						).email.toLowerCase() === body.filter.email.equals.toLowerCase()
					);
				return (
					(
						entry.properties["Clerk User ID"] as {
							rich_text: Array<{ text: { content: string } }>;
						}
					).rich_text[0].text.content === body.filter.rich_text.equals
				);
			});
			return Response.json({ results: filtered, has_more: false });
		}
		if (url.includes("/pages/"))
			return Response.json(rows.find((entry) => url.endsWith(entry.id)));
		return Response.json({
			properties: Object.fromEntries(
				Object.entries({
					...CRM_PROPERTIES,
					Student: "title",
					Email: "email",
				}).map(([name, type]) => [name, { type }]),
			),
		});
	});
	vi.stubGlobal("fetch", fetchMock);
	return { creates, fetchMock };
}
async function signup() {
	vi.stubEnv("NOTION_CRM_MODE", "off");
	const t = convexTest(schema, modules);
	const userId = await t
		.withIdentity(identity)
		.mutation(api.users.syncCurrentUser, {});
	vi.stubEnv("NOTION_CRM_TOKEN", "test-only");
	vi.stubEnv("NOTION_CRM_DATA_SOURCE_ID", source);
	return { t, userId };
}
afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

test("live signup schedules background reconciliation without performing network I/O in signup", async () => {
	vi.stubEnv("NOTION_CRM_MODE", "live");
	vi.useFakeTimers();
	try {
		const t = convexTest(schema, modules);
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		await t.withIdentity(identity).mutation(api.users.syncCurrentUser, {});
		await t.withIdentity(identity).mutation(api.users.syncCurrentUser, {});
		const scheduled = await t.run((ctx) =>
			ctx.db.system.query("_scheduled_functions").take(2),
		);
		expect(scheduled).toHaveLength(1);
		expect(scheduled[0].name).toContain("crmSync");
		expect(fetchMock).not.toHaveBeenCalled();
		vi.stubEnv("NOTION_CRM_MODE", "off");
		await t.finishAllScheduledFunctions(vi.runAllTimers);
	} finally {
		vi.useRealTimers();
	}
});

test("dry-run holds a second new signup with the same email instead of proposing duplicate creation", async () => {
	const { t } = await signup();
	await t
		.withIdentity({
			...identity,
			subject: "user_second",
			tokenIdentifier: "issuer|user_second",
		})
		.mutation(api.users.syncCurrentUser, {});
	const { creates } = mockNotion();
	expect(
		await t.action(internal.crmSync.reconcile, { dryRun: true }),
	).toMatchObject({ counts: { wouldCreate: 1, creationReview: 1 } });
	expect(creates).toHaveLength(0);
}, 15000);

test("concurrent claims allow only one create attempt and reject workers outside the lease", async () => {
	const { t } = await signup();
	mockNotion();
	await t.action(internal.crmSync.reconcile, { dryRun: true });
	vi.stubEnv("NOTION_CRM_MODE", "live");
	await t.mutation(internal.crmSyncState.begin, {
		runId: "worker",
		dataSourceId: source,
		mode: "live",
	});
	const [signupId] = await t.query(internal.crmSignupState.pending, {});
	const args = {
		signupId,
		runId: "worker",
		dataSourceId: source,
		clerkId: identity.subject,
		email: identity.email,
	};
	expect(
		await t.mutation(internal.crmSignupState.markAttempt, {
			...args,
			runId: "other",
		}),
	).toBe(false);
	expect(
		(
			await Promise.all([
				t.mutation(internal.crmSignupState.markAttempt, args),
				t.mutation(internal.crmSignupState.markAttempt, args),
			])
		).sort(),
	).toEqual([false, true]);
}, 15000);

test("authenticated signup queues once, login retries do not duplicate, legacy users are not backfilled", async () => {
	const { t, userId } = await signup();
	await t.withIdentity(identity).mutation(api.users.syncCurrentUser, {});
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentSignups").take(10)),
	).toMatchObject([{ userId, status: "pending" }]);
	await t.run(async (ctx) => {
		for (const r of await ctx.db.query("crmStudentSignups").take(10))
			await ctx.db.delete("crmStudentSignups", r._id);
	});
	await t.withIdentity(identity).mutation(api.users.syncCurrentUser, {});
	expect(await t.query(internal.crmSignupState.pending, {})).toEqual([]);
	await expect(t.mutation(api.users.syncCurrentUser, {})).rejects.toThrow();
});

test("off and dry-run never create, live creates minimal CRM record once and subsequent runs reuse it", async () => {
	const { t, userId } = await signup();
	const { creates, fetchMock } = mockNotion();
	expect(await t.action(internal.crmSync.reconcile, {})).toMatchObject({
		status: "disabled",
	});
	expect(fetchMock).not.toHaveBeenCalled();
	expect(
		await t.action(internal.crmSync.reconcile, { dryRun: true }),
	).toMatchObject({
		status: "complete",
		counts: { wouldCreate: 1, created: 0 },
	});
	expect(creates).toHaveLength(0);
	vi.stubEnv("NOTION_CRM_MODE", "live");
	expect(await t.action(internal.crmSync.reconcile, {})).toMatchObject({
		status: "complete",
		counts: { created: 1 },
	});
	expect(creates).toHaveLength(1);
	expect(creates[0].properties).toMatchObject({
		Student: { title: [{ text: { content: identity.name } }] },
		Email: { email: identity.email },
		"Clerk User ID": { rich_text: [{ text: { content: identity.subject } }] },
		"Convex User ID": { rich_text: [{ text: { content: userId } }] },
		"Entitlement State": { select: { name: "none" } },
	});
	for (const field of [
		"Phone Number",
		"Date of Birth",
		"Notes",
		"Status",
		"Payment Status",
		"School",
		"Learning Challenges",
	])
		expect(creates[0].properties).not.toHaveProperty(field);
	expect(JSON.stringify(creates)).not.toContain(identity.tokenIdentifier);
	expect(await t.query(internal.crmSignupState.pending, {})).toEqual([]);
	await t.action(internal.crmSync.reconcile, {});
	expect(creates).toHaveLength(1);
}, 15000);

test.each([
	"",
	"user_other",
])("an existing email collision (%s) is held for review, never linked or duplicated", async (clerkId) => {
	const { t } = await signup();
	const { creates } = mockNotion([row(clerkId, identity.email.toUpperCase())]);
	expect(
		await t.action(internal.crmSync.reconcile, { dryRun: true }),
	).toMatchObject({ counts: { creationReview: 1, wouldCreate: 0 } });
	vi.stubEnv("NOTION_CRM_MODE", "live");
	await t.action(internal.crmSync.reconcile, {});
	expect(creates).toHaveLength(0);
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentSignups").take(10)),
	).toMatchObject([{ status: "review", error: "identity_changed" }]);
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentLinks").take(10)),
	).toEqual([]);
}, 15000);

test("an existing Clerk match is reused without overwriting contact details", async () => {
	const { t, userId } = await signup();
	const { creates } = mockNotion([
		row(identity.subject, "crm-owned@example.com"),
	]);
	await t.action(internal.crmSync.reconcile, { dryRun: true });
	vi.stubEnv("NOTION_CRM_MODE", "live");
	await t.action(internal.crmSync.reconcile, {});
	expect(creates).toHaveLength(0);
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentLinks").take(10)),
	).toMatchObject([{ userId, pageId }]);
	expect(await t.query(internal.crmSignupState.pending, {})).toEqual([]);
}, 15000);

test.each([
	"lost",
	"unavailable",
	"forbidden",
] as const)("%s create response never produces a second POST", async (failure) => {
	const { t } = await signup();
	const { creates } = mockNotion([], failure);
	await t.action(internal.crmSync.reconcile, { dryRun: true });
	vi.stubEnv("NOTION_CRM_MODE", "live");
	expect(await t.action(internal.crmSync.reconcile, {})).toMatchObject({
		status: "failed",
	});
	expect(creates).toHaveLength(1);
	await t.action(internal.crmSync.reconcile, {});
	expect(creates).toHaveLength(1);
	const signups = await t.run((ctx) =>
		ctx.db.query("crmStudentSignups").take(10),
	);
	if (failure === "lost") expect(signups).toEqual([]);
	else expect(signups).toMatchObject([{ status: "review" }]);
}, 15000);

test("account deletion removes queued CRM creation before it can run", async () => {
	const { t } = await signup();
	const { creates } = mockNotion();
	await t
		.withIdentity(identity)
		.mutation(api.accountDeletion.deleteCurrentUserDataBatch, {});
	expect(await t.query(internal.crmSignupState.pending, {})).toEqual([]);
	await t.action(internal.crmSync.reconcile, { dryRun: true });
	vi.stubEnv("NOTION_CRM_MODE", "live");
	await t.action(internal.crmSync.reconcile, {});
	expect(creates).toHaveLength(0);
});

test("a persisted create attempt after worker failure or destination change cannot be repeated", async () => {
	const { t } = await signup();
	const { creates } = mockNotion();
	await t.run(async (ctx) => {
		const pending = await ctx.db.query("crmStudentSignups").first();
		if (pending)
			await ctx.db.patch("crmStudentSignups", pending._id, {
				attemptedAt: 1,
				dataSourceId: "another-destination",
			});
	});
	await t.action(internal.crmSync.reconcile, { dryRun: true });
	vi.stubEnv("NOTION_CRM_MODE", "live");
	await t.action(internal.crmSync.reconcile, {});
	expect(creates).toHaveLength(0);
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentSignups").first()),
	).toMatchObject({ status: "review" });
}, 15000);
