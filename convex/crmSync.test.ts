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

test("Notion pagination includes duplicates and inventories beyond 200 contacts", async () => {
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
	let largeCalls = 0;
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => {
			largeCalls++;
			return Response.json({
				results: Array.from({ length: largeCalls === 3 ? 1 : 100 }, () =>
					page(),
				),
				has_more: largeCalls < 3,
				next_cursor: largeCalls < 3 ? `cursor-${largeCalls}` : null,
			});
		}),
	);
	expect(await createNotionClient("test", source).students()).toHaveLength(201);
});

test("live audit checkpoints and completes an inventory larger than 200", async () => {
	configure();
	const t = convexTest(schema, modules);
	await enable(t);
	const rows = Array.from({ length: 201 }, (_, index) =>
		page(`00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`, ""),
	);
	const { patches } = mockNotion(rows);
	let inspected = 0;
	for (let batch = 0; batch < 9; batch++) {
		const result = await t.action(internal.crmSync.reconcile, {});
		await cancelScheduledCrm(t);
		expect(result.status).toBe("complete");
		inspected += result.counts.total;
		const state = await t.query(internal.crmSyncState.status, {});
		expect(Boolean(state?.auditCursor)).toBe(batch < 8);
	}
	await finishAudit(t);
	expect(inspected).toBe(201);
	expect(patches).toEqual([]);
	expect(
		(await t.query(internal.crmSyncState.status, {}))?.lastSuccessAt,
	).toBeTypeOf("number");
}, 15000);

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
	const batches = await finishAudit(t);
	expect(batches[0]).toMatchObject({ counts: { conflict: 2, synced: 0 } });
	expect(batches.at(-1)).toMatchObject({ counts: { paidWithoutCrm: 1 } });
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
			subscriptionProductId: "com.dayova.abonnement.monthly",
			subscriptionPeriodType: "normal",
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
		last_edited_time: "2026-09-20T00:00:00.000Z",
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
	const patchUrls: string[] = [];
	const fetchMock = vi.fn(
		async (input: string | URL | Request, init?: RequestInit) => {
			const url = String(input);
			if (init?.method === "PATCH") {
				const payload = JSON.parse(String(init.body));
				patches.push(payload);
				patchUrls.push(url);
				if (options.rateLimitOnce && !limited) {
					limited = true;
					return new Response("provider payload must not leak", {
						status: 429,
						headers: { "Retry-After": "1" },
					});
				}
				const target = rows.find((row) => url.endsWith(row.id));
				if (target) {
					if (payload.properties.Email)
						target.properties.Email.email = payload.properties.Email.email;
					target.last_edited_time = new Date(
						Date.now() + patches.length * 1000,
					).toISOString();
				}
				return Response.json({
					id: target?.id ?? pageId,
					last_edited_time: target?.last_edited_time,
				});
			}
			if (url.includes("/pages/")) {
				const found = options.changedIdentity
					? page(pageId, "user_other")
					: rows.find((row) => url.endsWith(row.id));
				return found
					? Response.json(found)
					: new Response(null, { status: 404 });
			}
			if (url.endsWith("/query")) {
				const body = JSON.parse(String(init?.body));
				const filtered = body.filter
					? rows.filter((row) =>
							body.filter.property === "Email"
								? row.properties.Email.email.toLowerCase() ===
									body.filter.email.equals.toLowerCase()
								: row.properties["Clerk User ID"].rich_text[0].plain_text ===
									body.filter.rich_text.equals,
						)
					: rows;
				const offset = body.start_cursor
					? Number(String(body.start_cursor).replace("cursor-", ""))
					: 0;
				const pageSize = body.page_size ?? 100;
				const hasMore = offset + pageSize < filtered.length;
				return Response.json({
					results: filtered.slice(offset, offset + pageSize),
					has_more: hasMore,
					next_cursor: hasMore ? `cursor-${offset + pageSize}` : null,
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
	return { fetchMock, patches, patchUrls };
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
async function finishAudit(t: TestContext) {
	const results = [];
	for (let batch = 0; batch < 50; batch++) {
		results.push(await t.action(internal.crmSync.reconcile, {}));
		await cancelScheduledCrm(t);
		if (!(await t.query(internal.crmSyncState.status, {}))?.auditPhase)
			return results;
	}
	throw new Error("CRM audit did not finish in 50 batches");
}
async function cancelScheduledCrm(t: TestContext) {
	await t.run(async (ctx) => {
		const jobs = await ctx.db.system.query("_scheduled_functions").take(100);
		for (const job of jobs)
			if (job.name.includes("crmSync")) await ctx.scheduler.cancel(job._id);
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

test("missing linked pages remain mapped for operator review, including non-paid users", async () => {
	configure();
	const t = convexTest(schema, modules);
	const paidUserId = await seed(t);
	const nonPaidUserId = await t.run((ctx) =>
		ctx.db.insert("users", {
			clerkId: "user_nonpaid",
			tokenIdentifier: "issuer|user_nonpaid",
			email: "nonpaid@example.com",
		}),
	);
	await t.mutation(internal.crmSyncState.recordLink, {
		pageId,
		userId: paidUserId,
		clerkId,
	});
	await t.mutation(internal.crmSyncState.recordLink, {
		pageId: secondPageId,
		userId: nonPaidUserId,
		clerkId: "user_nonpaid",
	});
	const { patches } = mockNotion([]);
	expect(
		await t.action(internal.crmSync.reconcile, { dryRun: true }),
	).toMatchObject({
		status: "complete",
		counts: { total: 0, missingLinkedPages: 2, paidWithoutCrm: 1 },
	});
	const linksBeforeLive = await t.run((ctx) =>
		ctx.db.query("crmStudentLinks").take(10),
	);
	expect(linksBeforeLive).toMatchObject([{ pageId }, { pageId: secondPageId }]);
	expect(linksBeforeLive.every((link) => !Object.hasOwn(link, "error"))).toBe(
		true,
	);
	const firstAudit = await finishAudit(t);
	expect(firstAudit[0]).toMatchObject({ counts: { total: 0 } });
	expect(firstAudit[1]).toMatchObject({ counts: { missingLinkedPages: 2 } });
	expect(firstAudit[2]).toMatchObject({ counts: { paidWithoutCrm: 1 } });
	expect(patches).toEqual([]);
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentLinks").take(10)),
	).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ pageId, error: "identity_changed" }),
			expect.objectContaining({
				pageId: secondPageId,
				error: "identity_changed",
			}),
		]),
	);
	mockNotion([page(), page(secondPageId, "user_nonpaid")]);
	expect((await finishAudit(t))[0]).toMatchObject({
		counts: { matched: 2, synced: 2 },
	});
	const recoveredLinks = await t.run((ctx) =>
		ctx.db.query("crmStudentLinks").take(10),
	);
	expect(recoveredLinks).toMatchObject([{ pageId }, { pageId: secondPageId }]);
	expect(recoveredLinks.every((link) => !Object.hasOwn(link, "error"))).toBe(
		true,
	);
}, 20_000);

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
	expect(payload.properties["Payment Status"]).toEqual({
		select: { name: "Paid" },
	});
	expect(payload.properties["Subscription Plan"]).toEqual({
		select: { name: "Monthly" },
	});
	for (const key of [
		"Clerk User ID",
		"Tags",
		"Status",
		"Registration Date",
		"Notes",
	])
		expect(payload.properties).not.toHaveProperty(key);
	expect(JSON.stringify(payload)).not.toContain(tokenIdentifier);
	expect(await t.action(internal.crmSync.reconcile, {})).toMatchObject({
		status: "complete",
		counts: { synced: 0 },
	});
	expect(patches).toHaveLength(2);
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentLinks").take(10)),
	).toMatchObject([{ userId, pageId }]);
}, 15_000);

test("existing linked students receive late onboarding profiles and subsequent edits without duplicates", async () => {
	configure();
	const t = convexTest(schema, modules);
	const userId = await seed(t);
	await enable(t);
	const { patches } = mockNotion();
	await finishAudit(t);
	// The CRM contact exists before the app has saved onboarding profile fields.
	expect((patches[0] as { properties: unknown }).properties).not.toHaveProperty(
		"Grade",
	);
	const authenticated = t.withIdentity({
		subject: clerkId,
		tokenIdentifier,
		email,
	});
	vi.stubEnv("NOTION_CRM_MODE", "off");
	await authenticated.mutation(api.users.syncCurrentUser, {
		name: "Anna von Beispiel",
		operatingSystem: "Android",
		grade: "10",
		state: "Bayern",
		schoolType: "gymnasium",
	});
	await authenticated.mutation(api.users.saveOnboardingAnswers, {
		answers: { grade: "10", state: "Bayern", schoolType: "gymnasium" },
	});
	vi.stubEnv("NOTION_CRM_MODE", "live");
	await finishAudit(t);
	expect((patches.at(-1) as { properties: unknown }).properties).toMatchObject({
		Student: { title: [{ text: { content: "Anna von Beispiel" } }] },
		"First Name": { rich_text: [{ text: { content: "Anna" } }] },
		"Last Name": { rich_text: [{ text: { content: "von Beispiel" } }] },
		Grade: { select: { name: "10" } },
		State: { select: { name: "BY" } },
		"School Type": { select: { name: "Gymnasium" } },
		OS: { multi_select: [{ name: "Android" }] },
	});
	vi.stubEnv("NOTION_CRM_MODE", "off");
	await authenticated.mutation(api.users.syncCurrentUser, {
		name: "Anna von Beispiel",
		operatingSystem: "iPadOS",
	});
	await authenticated.mutation(api.users.updateProfile, {
		name: "Alex",
		grade: "11",
		state: "Berlin",
		schoolType: "prefer_not_to_say",
	});
	vi.stubEnv("NOTION_CRM_MODE", "live");
	await finishAudit(t);
	expect((patches.at(-1) as { properties: unknown }).properties).toMatchObject({
		"First Name": { rich_text: [{ text: { content: "Alex" } }] },
		"Last Name": { rich_text: [] },
		Grade: { select: { name: "11" } },
		State: { select: { name: "BE" } },
		"School Type": { select: null },
		OS: { multi_select: [{ name: "Android" }, { name: "iPadOS" }] },
	});
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentLinks").take(5)),
	).toMatchObject([{ userId, pageId }]);
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentSignups").take(5)),
	).toEqual([]);
}, 15000);

test("a changed account email updates the linked Notion contact", async () => {
	configure();
	const t = convexTest(schema, modules);
	const userId = await seed(t);
	await enable(t);
	const { patches } = mockNotion();
	await finishAudit(t);
	vi.stubEnv("NOTION_CRM_MODE", "off");
	await t
		.withIdentity({ subject: clerkId, tokenIdentifier, email })
		.mutation(api.users.updateProfile, { email: "changed@example.com" });
	vi.stubEnv("NOTION_CRM_MODE", "live");
	await finishAudit(t);
	expect((patches[1] as { properties: unknown }).properties).toMatchObject({
		Email: { email: "changed@example.com" },
	});
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentLinks").take(5)),
	).toMatchObject([{ userId, pageId }]);
}, 15000);

test("a queued profile edit updates only its linked contact and drains once", async () => {
	configure();
	const t = convexTest(schema, modules);
	await seed(t);
	await t.run((ctx) =>
		ctx.db.insert("users", {
			clerkId: "user_other",
			tokenIdentifier: "issuer|user_other",
			email: "other@example.com",
		}),
	);
	await enable(t);
	const { patches, patchUrls } = mockNotion([
		page(),
		page(secondPageId, "user_other"),
	]);
	expect(await t.action(internal.crmSync.reconcile, {})).toMatchObject({
		counts: { synced: 2 },
	});
	const initialPatches = patches.length;
	await t
		.withIdentity({ subject: clerkId, tokenIdentifier, email })
		.mutation(api.users.updateProfile, { name: "Updated Student" });
	expect(
		await t.action(internal.crmSync.reconcile, { updatesOnly: true }),
	).toMatchObject({
		status: "complete",
		counts: { total: 1, synced: 1 },
	});
	expect(patchUrls.slice(initialPatches)).toEqual([
		`https://api.notion.com/v1/pages/${pageId}`,
	]);
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentUpdates").take(5)),
	).toEqual([]);
	expect(
		await t.action(internal.crmSync.reconcile, { updatesOnly: true }),
	).toMatchObject({
		counts: { total: 0, synced: 0 },
	});
	expect((await t.query(internal.crmSyncState.status, {}))?.auditPhase).toBe(
		"links",
	);
	await finishAudit(t);
	expect(
		(await t.query(internal.crmSyncState.status, {}))?.lastSuccessAt,
	).toBeTypeOf("number");
}, 15000);

test("a newer CRM update survives an older worker completion and retries transient errors", async () => {
	const t = convexTest(schema, modules);
	await seed(t);
	vi.stubEnv("NOTION_CRM_MODE", "live");
	const auth = t.withIdentity({ subject: clerkId, tokenIdentifier, email });
	await auth.mutation(api.users.updateProfile, { name: "First" });
	const first = (
		await t.run((ctx) => ctx.db.query("crmStudentUpdates").take(1))
	)[0];
	await auth.mutation(api.users.updateProfile, { name: "Second" });
	expect(
		await t.mutation(internal.crmUpdates.finish, {
			updateId: first._id,
			revision: first.revision,
		}),
	).toBe(false);
	const second = (
		await t.run((ctx) => ctx.db.query("crmStudentUpdates").take(1))
	)[0];
	expect(second.revision).toBe(2);
	expect(
		await t.mutation(internal.crmUpdates.finish, {
			updateId: second._id,
			revision: second.revision,
			error: "unavailable",
		}),
	).toBe(true);
	const retry = (
		await t.run((ctx) => ctx.db.query("crmStudentUpdates").take(1))
	)[0];
	expect(retry).toMatchObject({
		status: "pending",
		attempts: 1,
		error: "unavailable",
	});
	expect(retry.nextAttemptAt).toBeGreaterThan(Date.now());
	await auth.mutation(api.users.updateProfile, { name: "Third" });
	expect(
		await t.mutation(internal.crmUpdates.finish, {
			updateId: second._id,
			revision: second.revision,
		}),
	).toBe(false);
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentUpdates").take(1)),
	).toMatchObject([{ revision: 3, status: "pending", attempts: 0 }]);
});

test("unchanged audit skips Notion writes but repairs a later manual edit", async () => {
	configure();
	const t = convexTest(schema, modules);
	await seed(t);
	await enable(t);
	const row = page();
	const { patches } = mockNotion([row]);
	await finishAudit(t);
	expect(patches).toHaveLength(1);
	expect((await finishAudit(t))[0]).toMatchObject({
		counts: { synced: 0 },
	});
	expect(patches).toHaveLength(1);
	row.last_edited_time = new Date(
		Date.parse(row.last_edited_time) + 1000,
	).toISOString();
	expect((await finishAudit(t))[0]).toMatchObject({
		counts: { synced: 1 },
	});
	expect(patches).toHaveLength(2);
}, 15000);

test("an email already used by another Notion contact blocks the linked update", async () => {
	configure();
	const t = convexTest(schema, modules);
	await seed(t);
	await enable(t);
	const other = page(secondPageId, "user_other");
	other.properties.Email.email = "CHANGED@example.com";
	const { patches } = mockNotion([page(), other]);
	await finishAudit(t);
	expect(patches).toHaveLength(1);
	vi.stubEnv("NOTION_CRM_MODE", "off");
	await t
		.withIdentity({ subject: clerkId, tokenIdentifier, email })
		.mutation(api.users.updateProfile, { email: "changed@example.com" });
	vi.stubEnv("NOTION_CRM_MODE", "live");
	expect((await finishAudit(t))[0]).toMatchObject({
		status: "failed",
		counts: { failed: 1, synced: 0 },
	});
	expect(patches).toHaveLength(1);
}, 15000);

test("OS observations accumulate per authenticated account and only new platforms schedule sync", async () => {
	const t = convexTest(schema, modules);
	const authenticated = t.withIdentity({
		subject: clerkId,
		tokenIdentifier,
		email,
	});
	vi.useFakeTimers();
	try {
		vi.stubEnv("NOTION_CRM_MODE", "off");
		const userId = await authenticated.mutation(api.users.syncCurrentUser, {
			operatingSystem: "Android",
		});
		vi.stubEnv("NOTION_CRM_MODE", "live");
		await authenticated.mutation(api.users.syncCurrentUser, {
			operatingSystem: "Android",
		});
		await authenticated.mutation(api.users.syncCurrentUser, {});
		expect(
			await t.run((ctx) =>
				ctx.db.system.query("_scheduled_functions").take(10),
			),
		).toHaveLength(0);
		await authenticated.mutation(api.users.syncCurrentUser, {
			operatingSystem: "iOS",
		});
		await authenticated.mutation(api.users.syncCurrentUser, {
			operatingSystem: "iOS",
		});
		vi.stubEnv("NOTION_CRM_MODE", "off");
		await authenticated.mutation(api.users.syncCurrentUser, {
			operatingSystem: "iPadOS",
		});
		await authenticated.mutation(api.users.syncCurrentUser, {});
		expect(await t.run((ctx) => ctx.db.get("users", userId))).toMatchObject({
			operatingSystems: ["Android", "iOS", "iPadOS"],
		});
		expect(
			await t.run((ctx) =>
				ctx.db.system.query("_scheduled_functions").take(10),
			),
		).toHaveLength(1);
		const otherUserId = await t
			.withIdentity({
				subject: "user_other",
				tokenIdentifier: "issuer|user_other",
				email: "other@example.com",
			})
			.mutation(api.users.syncCurrentUser, { operatingSystem: "iOS" });
		expect(
			await t.run((ctx) => ctx.db.get("users", otherUserId)),
		).toMatchObject({ operatingSystems: ["iOS"] });
		await expect(
			t.mutation(api.users.syncCurrentUser, { operatingSystem: "Android" }),
		).rejects.toThrow();
		await t.finishAllScheduledFunctions(vi.runAllTimers);
	} finally {
		vi.useRealTimers();
	}
});

test("profile changes schedule live reconciliation once, while unchanged sign-ins and off mode do not", async () => {
	const t = convexTest(schema, modules);
	await seed(t);
	const authenticated = t.withIdentity({
		subject: clerkId,
		tokenIdentifier,
		email,
	});
	vi.useFakeTimers();
	try {
		vi.stubEnv("NOTION_CRM_MODE", "live");
		await authenticated.mutation(api.users.syncCurrentUser, {
			name: "Test Student",
			grade: "10",
		});
		await authenticated.mutation(api.users.syncCurrentUser, {
			name: "Test Student",
			grade: "10",
		});
		await authenticated.mutation(api.users.updateProfile, { state: "Berlin" });
		await authenticated.mutation(api.users.updateProfile, { state: "Berlin" });
		await authenticated.mutation(api.users.updateProfile, {
			email: "changed@example.com",
		});
		await authenticated.mutation(api.users.updateProfile, {
			email: "changed@example.com",
		});
		vi.stubEnv("NOTION_CRM_MODE", "off");
		await authenticated.mutation(api.users.updateProfile, { grade: "11" });
		const scheduled = await t.run((ctx) =>
			ctx.db.system.query("_scheduled_functions").take(10),
		);
		expect(scheduled).toHaveLength(1);
		expect(
			await t.run((ctx) => ctx.db.query("crmStudentUpdates").take(5)),
		).toMatchObject([{ revision: 3, status: "pending" }]);
		expect(scheduled.every((job) => job.name.includes("crmSync"))).toBe(true);
		await t.finishAllScheduledFunctions(vi.runAllTimers);
	} finally {
		vi.useRealTimers();
	}
});

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
	const currentUserId = await t.run((ctx) =>
		ctx.db.insert("users", {
			clerkId: "user_other",
			tokenIdentifier: "issuer|user_other",
			email: "other@example.com",
		}),
	);
	await enable(t);
	const { patches } = mockNotion([page()], { changedIdentity: true });
	expect(await t.action(internal.crmSync.reconcile, {})).toMatchObject({
		status: "failed",
		counts: { synced: 0, failed: 1 },
	});
	expect(patches).toEqual([]);
	expect(await t.run((ctx) => ctx.db.query("crmStudentLinks").take(2))).toEqual(
		[],
	);
	expect(await t.query(internal.crmSyncState.status, {})).toMatchObject({
		counts: { failed: 1 },
		running: false,
	});
	await finishAudit(t);
	mockNotion([page(pageId, "user_other")]);
	expect(await t.action(internal.crmSync.reconcile, {})).toMatchObject({
		status: "complete",
		counts: { matched: 1, conflict: 0, synced: 1 },
	});
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentLinks").take(2)),
	).toMatchObject([{ pageId, userId: currentUserId }]);
});

test("error reports update an existing link without creating a new mapping", async () => {
	const t = convexTest(schema, modules);
	const userId = await seed(t);
	const link = { pageId, userId, clerkId };
	expect(
		await t.mutation(internal.crmSyncState.recordLink, {
			...link,
			error: "unavailable",
		}),
	).toBe(false);
	expect(await t.run((ctx) => ctx.db.query("crmStudentLinks").take(2))).toEqual(
		[],
	);
	expect(
		await t.mutation(internal.crmSyncState.recordLink, {
			...link,
			syncedAt: 123,
		}),
	).toBe(true);
	expect(
		await t.mutation(internal.crmSyncState.recordLink, {
			...link,
			error: "unavailable",
		}),
	).toBe(true);
	expect(
		await t.run((ctx) => ctx.db.query("crmStudentLinks").take(2)),
	).toMatchObject([
		{ pageId, userId, error: "unavailable", lastSyncedAt: 123 },
	]);
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
