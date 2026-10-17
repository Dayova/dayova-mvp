/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { CRM_PROPERTIES, deletedAccountProperties } from "./crmNotion";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const source = "11111111-1111-4111-8111-111111111111";
const pageId = "22222222-2222-4222-8222-222222222222";
const identity = {
	issuer: "https://test.clerk",
	subject: "user_deleted",
	tokenIdentifier: "https://test.clerk|user_deleted",
	email: "keep@example.com",
};
afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

async function fixture() {
	vi.stubEnv("NOTION_CRM_DATA_SOURCE_ID", source);
	vi.stubEnv("NOTION_CRM_TOKEN", "test-only");
	vi.stubEnv("NOTION_CRM_DELETION_MODE", "live");
	vi.stubEnv("NOTION_CRM_MODE", "off");
	const t = convexTest(schema, modules),
		user = t.withIdentity(identity);
	const userId = await user.mutation(api.users.syncCurrentUser, {});
	await t.run((ctx) =>
		ctx.db.insert("crmStudentLinks", { userId, pageId, lastAttemptAt: 1 }),
	);
	const request = await user.mutation(
		internal.accountDeletion.enqueueVerifiedDeletion,
		{},
	);
	await t.run(async (ctx) => {
		const row = await ctx.db.query("accountDeletionRequests").unique();
		if (!row) throw new Error("Missing request");
		await ctx.db.patch("accountDeletionRequests", row._id, {
			stage: "deleteNotion",
		});
	});
	const properties: Record<string, unknown> = {
		"Clerk User ID": {
			type: "rich_text",
			rich_text: [{ plain_text: identity.subject }],
		},
		Student: { title: [{ text: { content: "Keep Contact" } }] },
		Email: { email: "keep@example.com" },
		Notes: { rich_text: [{ text: { content: "Keep notes" } }] },
		Tags: { multi_select: [{ name: "Keep tag" }] },
		Status: { status: { name: "Active" } },
		Grade: { select: { name: "10" } },
		"Registration Date": { date: { start: "2026-01-01" } },
	};
	const page = () => ({
		id: pageId,
		parent: { data_source_id: source },
		properties,
	});
	let patches = 0,
		loseResponse = false;
	const fetch = vi.fn(async (url: string, init?: RequestInit) => {
		if (url.endsWith(`/data_sources/${source}`))
			return Response.json({
				properties: Object.fromEntries(
					Object.entries(CRM_PROPERTIES).map(([name, type]) => [
						name,
						{ type },
					]),
				),
			});
		if (url.endsWith("/query")) {
			const id = (
				properties["Clerk User ID"] as {
					rich_text: Array<{ plain_text?: string; text?: { content: string } }>;
				}
			).rich_text;
			return Response.json({
				results: id.length ? [page()] : [],
				has_more: false,
				next_cursor: null,
			});
		}
		if (url.endsWith(`/pages/${pageId}`)) {
			if (init?.method === "PATCH") {
				patches++;
				for (const [key, value] of Object.entries(
					JSON.parse(String(init.body)).properties,
				)) {
					properties[key] = {
						...((properties[key] as object) ?? {}),
						...(value as object),
					};
				}
				const deletionDate = properties["App Account Deleted At"] as {
					date?: { start: string };
				};
				if (deletionDate?.date)
					deletionDate.date.start = new Date(
						Math.floor(Date.parse(deletionDate.date.start) / 60_000) * 60_000,
					).toISOString();
				if (loseResponse) {
					loseResponse = false;
					return new Response("ambiguous success", { status: 200 });
				}
			}
			return Response.json(page());
		}
		throw new Error("Unexpected request");
	});
	vi.stubGlobal("fetch", fetch);
	return {
		t,
		request,
		properties,
		fetch,
		patches: () => patches,
		loseResponse: () => {
			loseResponse = true;
		},
	};
}

test("retains CRM contact/profile/history and clears only current app identity/access", () => {
	const patch = deletedAccountProperties(1000, 2000);
	for (const preserved of [
		"Student",
		"Email",
		"First Name",
		"Last Name",
		"Notes",
		"Tags",
		"Status",
		"Registration Date",
		"Grade",
		"School",
		"School Type",
		"Phone Number",
	])
		expect(patch).not.toHaveProperty(preserved);
	expect(patch).toMatchObject({
		"Clerk User ID": { rich_text: [] },
		"Convex User ID": { rich_text: [] },
		"App Account Status": { select: { name: "deleted" } },
		"Subscription Expires At": { date: null },
		"Will Renew": { checkbox: false },
	});
});

test("cleanup works with normal CRM disabled, verifies the marker and completes the deletion", async () => {
	const { t, request, properties, patches } = await fixture();
	const preserved = Object.fromEntries(
		[
			"Student",
			"Email",
			"Notes",
			"Tags",
			"Status",
			"Grade",
			"Registration Date",
		].map((key) => [key, properties[key]]),
	);
	expect(
		await t.action(internal.crmAccountDeletion.reconcile, {
			requestId: request.requestId,
		}),
	).toBe("complete");
	expect(properties).toMatchObject(preserved);
	expect(properties["App Account Status"]).toEqual({
		select: { name: "deleted" },
	});
	expect(patches()).toBe(1);
	expect(
		await t.mutation(internal.accountDeletion.completeRequest, {
			requestId: request.requestId,
		}),
	).toBe(true);
	const row = await t.query(internal.accountDeletion.getRequestForProcessing, {
		requestId: request.requestId,
	});
	expect(row).toMatchObject({ stage: "complete", crmDeletionVerified: true });
	expect(row).not.toHaveProperty("clerkUserId");
	expect(row).not.toHaveProperty("crmPageId");
	await expect(
		t
			.withIdentity(identity)
			.mutation(internal.accountDeletion.enqueueVerifiedDeletion, {}),
	).rejects.toThrow("bereits gelöscht");
	expect(
		await t.run((ctx) => ctx.db.query("accountDeletionRequests").take(10)),
	).toHaveLength(1);
}, 10_000);

test("lost PATCH response recovers by persisted page ID after the Clerk ID was cleared", async () => {
	const { t, request, loseResponse, patches } = await fixture();
	loseResponse();
	await expect(
		t.action(internal.crmAccountDeletion.reconcile, {
			requestId: request.requestId,
		}),
	).rejects.toThrow("schema");
	expect(
		await t.query(internal.accountDeletion.getRequestForProcessing, {
			requestId: request.requestId,
		}),
	).toMatchObject({ crmPageId: pageId, stage: "deleteNotion" });
	expect(
		await t.action(internal.crmAccountDeletion.reconcile, {
			requestId: request.requestId,
		}),
	).toBe("complete");
	expect(patches()).toBe(1);
}, 10_000);

test("changed identity/destination and missing cleanup configuration fail closed", async () => {
	const { t, request, properties, patches } = await fixture();
	properties["Clerk User ID"] = {
		type: "rich_text",
		rich_text: [{ plain_text: "user_someone_else" }],
	};
	await expect(
		t.action(internal.crmAccountDeletion.reconcile, {
			requestId: request.requestId,
		}),
	).rejects.toThrow("identity");
	vi.stubEnv(
		"NOTION_CRM_DATA_SOURCE_ID",
		"33333333-3333-4333-8333-333333333333",
	);
	await expect(
		t.action(internal.crmAccountDeletion.reconcile, {
			requestId: request.requestId,
		}),
	).rejects.toThrow("configuration");
	vi.stubEnv("NOTION_CRM_DATA_SOURCE_ID", source);
	vi.stubEnv("NOTION_CRM_DELETION_MODE", "off");
	await expect(
		t.action(internal.crmAccountDeletion.reconcile, {
			requestId: request.requestId,
		}),
	).rejects.toThrow("configuration");
	expect(patches()).toBe(0);
	expect(
		await t.mutation(internal.accountDeletion.completeRequest, {
			requestId: request.requestId,
		}),
	).toBe(false);
}, 10_000);

test("cleanup yields to an in-flight normal audit instead of racing its PATCH", async () => {
	const { t, request, patches } = await fixture();
	await t.run((ctx) =>
		ctx.db.insert("crmSyncState", {
			key: "students",
			runId: "active",
			dataSourceId: source,
			mode: "live",
			running: true,
			startedAt: Date.now(),
			counts: {
				total: 0,
				matched: 0,
				unmatched: 0,
				proposed: 0,
				conflict: 0,
				paidWithoutCrm: 0,
				paidWithoutEntitlement: 0,
				synced: 0,
				failed: 0,
			},
		}),
	);
	expect(
		await t.action(internal.crmAccountDeletion.reconcile, {
			requestId: request.requestId,
		}),
	).toBe("busy");
	expect(patches()).toBe(0);
});

test("missing destination does not pin an unreviewable page from an unknown CRM", async () => {
	const { t } = await fixture();
	const other = t.withIdentity({
		...identity,
		subject: "user_other",
		tokenIdentifier: "https://test.clerk|user_other",
	});
	const userId = await other.mutation(api.users.syncCurrentUser, {});
	await t.run((ctx) =>
		ctx.db.insert("crmStudentLinks", { userId, pageId, lastAttemptAt: 1 }),
	);
	vi.stubEnv("NOTION_CRM_DATA_SOURCE_ID", undefined);
	const request = await other.mutation(
		internal.accountDeletion.enqueueVerifiedDeletion,
		{},
	);
	const row = await t.query(internal.accountDeletion.getRequestForProcessing, {
		requestId: request.requestId,
	});
	expect(row).not.toHaveProperty("crmPageId");
	expect(row).not.toHaveProperty("crmDataSourceId");
});

test("cleanup lease preserves normal audit history, progress and destination", async () => {
	const { t } = await fixture();
	const previous = {
		key: "students",
		runId: "previous-audit",
		dataSourceId: "previous-destination",
		mode: "dry-run" as const,
		running: false,
		startedAt: 1,
		finishedAt: 2,
		dryRunAt: 2,
		liveVerifiedAt: 3,
		lastSuccessAt: 4,
		auditCursor: "resume-here",
		auditPhase: "students" as const,
		auditFailed: 1,
		counts: {
			total: 73,
			matched: 53,
			unmatched: 20,
			proposed: 0,
			conflict: 0,
			paidWithoutCrm: 0,
			paidWithoutEntitlement: 0,
			synced: 0,
			failed: 0,
		},
	};
	await t.run((ctx) => ctx.db.insert("crmSyncState", previous));
	expect(
		await t.mutation(internal.crmSyncState.begin, {
			runId: "cleanup",
			dataSourceId: source,
			mode: "cleanup",
			countAsAudit: false,
		}),
	).toBe(true);
	await t.mutation(internal.crmSyncState.finish, {
		runId: "cleanup",
		countAsAudit: false,
		counts: { ...previous.counts, failed: 1 },
		error: "unavailable",
	});
	const state = await t.run((ctx) => ctx.db.query("crmSyncState").unique());
	const { runId: _runId, startedAt: _startedAt, ...preserved } = previous;
	expect(state).toMatchObject(preserved);
	expect(state).not.toHaveProperty("cleanupLease");
});
