/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { emptyCounts } from "./crmContract";
import {
	CRM_PROPERTIES,
	createNotionClient,
	projectionProperties,
} from "./crmNotion";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("Notion pagination includes duplicates on later pages and rejects oversized inventories", async () => {
	let calls = 0;
	vi.stubGlobal(
		"fetch",
		vi.fn(async () =>
			Response.json(
				++calls === 1
					? { results: [page()], has_more: true, next_cursor: "next" }
					: {
							results: [page(secondPageId)],
							has_more: false,
							next_cursor: null,
						},
			),
		),
	);
	expect(await createNotionClient("test", source).students()).toHaveLength(2);
	vi.stubGlobal(
		"fetch",
		vi.fn(async () =>
			Response.json({
				results: Array.from({ length: 201 }, () => page()),
				has_more: false,
			}),
		),
	);
	await expect(
		createNotionClient("test", source).students(),
	).rejects.toMatchObject({ category: "capacity" });
});

test("provider errors contain only a controlled category and never a response body", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response("secret provider identity payload", { status: 403 }),
		),
	);
	await expect(
		createNotionClient("secret_test", source).checkSchema(true),
	).rejects.toMatchObject({
		category: "unauthorized",
		message: "CRM sync: unauthorized",
	});
});

test("a successful live run continues after the first dry-run window and destination changes invalidate it", async () => {
	const t = convexTest(schema, modules);
	await enable(t);
	await t.mutation(internal.crmSyncState.begin, {
		runId: "first-live",
		dataSourceId: source,
		mode: "live",
	});
	await t.mutation(internal.crmSyncState.finish, {
		runId: "first-live",
		counts: emptyCounts(),
	});
	await t.run(async (ctx) => {
		const row = await ctx.db.query("crmSyncState").unique();
		if (row)
			await ctx.db.patch("crmSyncState", row._id, {
				dryRunAt: Date.now() - 48 * 3600_000,
			});
	});
	expect(
		await t.mutation(internal.crmSyncState.begin, {
			runId: "later-live",
			dataSourceId: source,
			mode: "live",
		}),
	).toBe(true);
	await t.mutation(internal.crmSyncState.finish, {
		runId: "later-live",
		counts: emptyCounts(),
	});
	await expect(
		t.mutation(internal.crmSyncState.begin, {
			runId: "wrong-target",
			dataSourceId: pageId,
			mode: "live",
		}),
	).rejects.toThrow("dry run");
});

test("duplicate identities prevent every write, even when the duplicate is on another Notion page", async () => {
	configure();
	const t = convexTest(schema, modules);
	await seed(t);
	await enable(t);
	const { patches } = mockNotion([page(), page(secondPageId)]);
	expect(await t.action(internal.crmSync.reconcile, {})).toMatchObject({
		counts: { conflict: 2, synced: 0, paidWithoutCrm: 1 },
	});
	expect(patches).toEqual([]);
});

test("an expired worker lease is recoverable and its late completion cannot replace the current result", async () => {
	const t = convexTest(schema, modules);
	await t.mutation(internal.crmSyncState.begin, {
		runId: "old",
		dataSourceId: source,
		mode: "dry-run",
	});
	await t.run(async (ctx) => {
		const row = await ctx.db.query("crmSyncState").unique();
		if (row)
			await ctx.db.patch("crmSyncState", row._id, {
				startedAt: Date.now() - 12 * 60_000,
			});
	});
	expect(
		await t.mutation(internal.crmSyncState.begin, {
			runId: "new",
			dataSourceId: source,
			mode: "dry-run",
		}),
	).toBe(true);
	await t.mutation(internal.crmSyncState.finish, {
		runId: "old",
		counts: { ...emptyCounts(), total: 99 },
	});
	expect(await t.query(internal.crmSyncState.status, {})).toMatchObject({
		running: true,
		counts: { total: 0 },
	});
});
const source = "d6268034-4ccc-4158-b82f-8f32d97bf401";
const pageId = "11111111-1111-4111-8111-111111111111";
const secondPageId = "22222222-2222-4222-8222-222222222222";
const clerkId = "user_crm_test";
const tokenIdentifier = `https://clerk.example|${clerkId}`;
const email = "test@example.com";
type TestContext = ReturnType<typeof convexTest>;

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

async function seed(
	t: TestContext,
	fields: Partial<Doc<"accessEntitlements">> = {},
) {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {
			clerkId,
			tokenIdentifier,
			email,
		});
		await ctx.db.insert("accessEntitlements", {
			userId,
			ownerTokenIdentifier: tokenIdentifier,
			revenueCatEntitlementActive: true,
			subscriptionVerifiedAt: Date.now(),
			subscriptionExpiresAt: Date.now() + 86400_000,
			subscriptionProductId: "dayova_monthly",
			subscriptionStore: "app_store",
			subscriptionWillRenew: true,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			...fields,
		});
		return userId;
	});
}
function page(id = pageId, key = clerkId) {
	return {
		id,
		archived: false,
		parent: { data_source_id: source },
		properties: {
			"Clerk User ID": { type: "rich_text", rich_text: [{ plain_text: key }] },
			Email: { email },
			"Payment Status": { select: { name: "Paid" } },
		},
	};
}
function configure() {
	vi.stubEnv("NOTION_CRM_TOKEN", "secret_test_only");
	vi.stubEnv("NOTION_CRM_DATA_SOURCE_ID", source);
	vi.stubEnv("NOTION_CRM_MODE", "live");
}
function mockNotion(
	rows = [page()],
	options: {
		changedIdentity?: boolean;
		rateLimitOnce?: boolean;
		schemaMissing?: boolean;
	} = {},
) {
	let limited = false;
	const patches: unknown[] = [];
	const fetchMock = vi.fn(
		async (input: string | URL | Request, init?: RequestInit) => {
			const url = String(input);
			if (init?.method === "PATCH") {
				const payload = JSON.parse(String(init.body));
				patches.push(payload);
				if (options.rateLimitOnce && !limited) {
					limited = true;
					return new Response("provider payload must not leak", {
						status: 429,
						headers: { "Retry-After": "1" },
					});
				}
				return Response.json({ id: pageId });
			}
			if (url.includes("/pages/"))
				return Response.json(
					options.changedIdentity
						? page(pageId, "user_other")
						: rows.find((row) => url.endsWith(row.id)),
				);
			if (url.endsWith("/query")) {
				const body = JSON.parse(String(init?.body));
				const filtered = body.filter
					? rows.filter(
							(row) =>
								row.properties["Clerk User ID"].rich_text[0].plain_text ===
								body.filter.rich_text.equals,
						)
					: rows;
				return Response.json({
					results: filtered,
					has_more: false,
					next_cursor: null,
				});
			}
			return Response.json({
				properties: Object.fromEntries(
					Object.entries(CRM_PROPERTIES)
						.filter(
							([name]) => !options.schemaMissing || name === "Clerk User ID",
						)
						.map(([name, type]) => [name, { type }]),
				),
			});
		},
	);
	vi.stubGlobal("fetch", fetchMock);
	return { fetchMock, patches };
}
async function enable(t: TestContext) {
	await t.mutation(internal.crmSyncState.begin, {
		runId: "dry",
		dataSourceId: source,
		mode: "dry-run",
	});
	await t.mutation(internal.crmSyncState.finish, {
		runId: "dry",
		counts: emptyCounts(),
	});
}

test("dry run aggregates exact, proposed, unmatched, duplicates, stale Paid and missing CRM without writes", async () => {
	configure();
	const t = convexTest(schema, modules);
	await seed(t);
	await t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {
			clerkId: "user_missing",
			tokenIdentifier: "issuer|missing",
			email: "missing@example.com",
		});
		await ctx.db.insert("accessEntitlements", {
			userId,
			ownerTokenIdentifier: "issuer|missing",
			revenueCatEntitlementActive: true,
			subscriptionVerifiedAt: Date.now(),
			createdAt: 1,
			updatedAt: 1,
		});
	});
	const rows = [
		page(),
		page(secondPageId, ""),
		page("33333333-3333-4333-8333-333333333333", "unknown"),
		page("44444444-4444-4444-8444-444444444444", "duplicate"),
		page("55555555-5555-4555-8555-555555555555", "duplicate"),
	];
	const { patches } = mockNotion(rows);
	const result = await t.action(internal.crmSync.reconcile, { dryRun: true });
	expect(result).toEqual({
		status: "complete",
		counts: {
			total: 5,
			matched: 1,
			proposed: 1,
			unmatched: 1,
			conflict: 2,
			paidWithoutEntitlement: 4,
			paidWithoutCrm: 1,
			synced: 0,
			failed: 0,
		},
	});
	expect(patches).toHaveLength(0);
	expect(JSON.stringify(result)).not.toContain(email);
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentLinks").take(10)),
	).toEqual([]);
});

test("live projection retries the same payload, preserves CRM-owned fields and recovers on repeated runs", async () => {
	configure();
	const t = convexTest(schema, modules);
	const userId = await seed(t);
	await enable(t);
	const { patches } = mockNotion([page()], { rateLimitOnce: true });
	const result = await t.action(internal.crmSync.reconcile, {});
	expect(result.status).toBe("complete");
	expect(result.counts.synced).toBe(1);
	expect(patches).toHaveLength(2);
	expect(patches[0]).toEqual(patches[1]);
	const payload = patches[0] as { properties: Record<string, unknown> };
	expect(payload.properties["Entitlement State"]).toEqual({
		select: { name: "paid" },
	});
	for (const key of [
		"Clerk User ID",
		"Email",
		"Payment Status",
		"Status",
		"Notes",
		"Subscription Plan",
	])
		expect(payload.properties).not.toHaveProperty(key);
	expect(JSON.stringify(payload)).not.toContain(tokenIdentifier);
	expect(await t.action(internal.crmSync.reconcile, {})).toMatchObject({
		status: "complete",
		counts: { synced: 1 },
	});
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentLinks").take(10)),
	).toMatchObject([{ userId, pageId }]);
}, 15_000);

test.each([
	[
		"trial",
		{
			revenueCatEntitlementActive: false,
			trialStartedAt: 1,
			trialExpiresAt: Date.now() + 100000,
			trialReminderAt: 2,
			trialTermsVersion: "v1",
		},
	],
	[
		"billing grace",
		{
			subscriptionExpiresAt: 1,
			subscriptionGraceExpiresAt: Date.now() + 100000,
			subscriptionBillingIssueDetectedAt: 1,
		},
	],
	["expired", { subscriptionExpiresAt: 1 }],
	["expired", { revenueCatEntitlementActive: false }],
] as const)("projects effective %s access including revoked/expired provider state", async (state, fields) => {
	const t = convexTest(schema, modules);
	await seed(t, fields);
	expect(
		await t.query(internal.crmSyncState.inspectStudent, {
			pageId,
			clerkId,
			now: Date.now(),
		}),
	).toMatchObject({ status: "matched", projection: { state } });
});

test("missing entitlement clears old subscription fields and unverified active flags are conflicts", async () => {
	const t = convexTest(schema, modules);
	await seed(t, { subscriptionVerifiedAt: undefined });
	expect(
		await t.query(internal.crmSyncState.inspectStudent, {
			pageId,
			clerkId,
			now: Date.now(),
		}),
	).toEqual({ status: "conflict" });
	await t.run(async (ctx) => {
		const rows = await ctx.db.query("accessEntitlements").take(2);
		for (const row of rows) await ctx.db.delete("accessEntitlements", row._id);
	});
	const result = await t.query(internal.crmSyncState.inspectStudent, {
		pageId,
		clerkId,
		now: Date.now(),
	});
	expect(result).toMatchObject({
		status: "matched",
		projection: {
			state: "none",
			product: null,
			expiresAt: null,
			willRenew: false,
		},
	});
	if (result.status !== "matched") throw new Error("expected matched");
	expect(
		projectionProperties(result.projection, Date.now())[
			"Subscription Expires At"
		],
	).toEqual({ date: null });
});

test("duplicate Convex identities and changed durable mappings cannot be matched", async () => {
	const t = convexTest(schema, modules);
	const userId = await seed(t);
	await t.mutation(internal.crmSyncState.recordLink, {
		pageId,
		userId,
		clerkId,
	});
	expect(
		await t.query(internal.crmSyncState.inspectStudent, {
			pageId: secondPageId,
			clerkId,
			now: Date.now(),
		}),
	).toEqual({ status: "conflict" });
	await t.run((ctx) =>
		ctx.db.insert("users", {
			clerkId,
			tokenIdentifier: "other|duplicate",
			email,
		}),
	);
	expect(
		await t.query(internal.crmSyncState.inspectStudent, {
			pageId,
			clerkId,
			now: Date.now(),
		}),
	).toEqual({ status: "conflict" });
});

test("changed Notion identity is skipped before PATCH and reported for manual review", async () => {
	configure();
	const t = convexTest(schema, modules);
	await seed(t);
	await enable(t);
	const { patches } = mockNotion([page()], { changedIdentity: true });
	expect(await t.action(internal.crmSync.reconcile, {})).toMatchObject({
		status: "failed",
		counts: { synced: 0, failed: 1 },
	});
	expect(patches).toEqual([]);
	expect(await t.query(internal.crmSyncState.status, {})).toMatchObject({
		counts: { failed: 1 },
		running: false,
	});
});

test("missing schema stops live writes while dry run remains usable", async () => {
	configure();
	const t = convexTest(schema, modules);
	await seed(t);
	await enable(t);
	const { patches } = mockNotion([page()], { schemaMissing: true });
	expect(await t.action(internal.crmSync.reconcile, {})).toMatchObject({
		status: "failed",
		error: "schema",
	});
	expect(patches).toEqual([]);
	expect(
		await t.action(internal.crmSync.reconcile, { dryRun: true }),
	).toMatchObject({ status: "complete", counts: { matched: 1 } });
});

test("live requires a dry run, overlapping workers are excluded, and old completions cannot unlock a new run", async () => {
	const t = convexTest(schema, modules);
	await expect(
		t.mutation(internal.crmSyncState.begin, {
			runId: "live",
			dataSourceId: source,
			mode: "live",
		}),
	).rejects.toThrow("dry run");
	expect(
		await t.mutation(internal.crmSyncState.begin, {
			runId: "first",
			dataSourceId: source,
			mode: "dry-run",
		}),
	).toBe(true);
	expect(
		await t.mutation(internal.crmSyncState.begin, {
			runId: "other",
			dataSourceId: source,
			mode: "dry-run",
		}),
	).toBe(false);
	await t.mutation(internal.crmSyncState.finish, {
		runId: "other",
		counts: emptyCounts(),
	});
	expect(await t.query(internal.crmSyncState.status, {})).toMatchObject({
		running: true,
	});
});

test("account deletion removes the new integration mapping", async () => {
	const t = convexTest(schema, modules);
	const userId = await seed(t);
	await t.mutation(internal.crmSyncState.recordLink, {
		pageId,
		userId,
		clerkId,
	});
	await t
		.withIdentity({ tokenIdentifier, subject: clerkId })
		.mutation(api.accountDeletion.deleteCurrentUserDataBatch, {});
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentLinks").take(10)),
	).toEqual([]);
});
