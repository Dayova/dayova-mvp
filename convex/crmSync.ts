import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { env, internalAction } from "./_generated/server";
import {
	type CrmError,
	type CrmMatch,
	crmCounts,
	crmError,
	emptyCounts,
} from "./crmContract";
import { CrmFailure, createNotionClient } from "./crmNotion";
import { provisionSignups } from "./crmSignup";

export const reconcile = internalAction({
	args: { dryRun: v.optional(v.boolean()) },
	returns: v.object({
		status: v.union(
			v.literal("disabled"),
			v.literal("busy"),
			v.literal("complete"),
			v.literal("failed"),
		),
		counts: crmCounts,
		error: v.optional(crmError),
	}),
	handler: async (ctx, args) => {
		const counts = emptyCounts();
		const mode = env.NOTION_CRM_MODE ?? "off";
		if (mode === "off" && args.dryRun !== true)
			return { status: "disabled" as const, counts };
		const dryRun = args.dryRun === true || mode !== "live";
		const dataSourceId = env.NOTION_CRM_DATA_SOURCE_ID;
		if (!env.NOTION_CRM_TOKEN || !dataSourceId)
			return {
				status: "failed" as const,
				counts,
				error: "configuration" as const,
			};
		const runId = crypto.randomUUID();
		const started = await ctx.runMutation(internal.crmSyncState.begin, {
			runId,
			dataSourceId,
			mode: dryRun ? "dry-run" : "live",
		});
		if (!started) return { status: "busy" as const, counts };
		let error: CrmError | undefined;
		try {
			const notion = createNotionClient(env.NOTION_CRM_TOKEN, dataSourceId);
			await notion.checkSchema(!dryRun);
			// Complete inventory before any writes; never decide uniqueness from a truncated page.
			const students = await notion.students();
			counts.total = students.length;
			const idCounts = new Map<string, number>();
			for (const row of students)
				if (row.clerkId)
					idCounts.set(row.clerkId, (idCounts.get(row.clerkId) ?? 0) + 1);
			const matchedIds = new Set<string>();
			for (const row of students) {
				const match: CrmMatch =
					(idCounts.get(row.clerkId) ?? 0) > 1
						? { status: "conflict" }
						: await ctx.runQuery(internal.crmSyncState.inspectStudent, {
								pageId: row.pageId,
								clerkId: row.clerkId,
								...(dryRun && row.email ? { email: row.email } : {}),
								now: Date.now(),
							});
				counts[match.status]++;
				if (
					row.markedPaid &&
					(match.status !== "matched" ||
						!["paid", "billing grace"].includes(match.projection.state))
				)
					counts.paidWithoutEntitlement++;
				if (match.status !== "matched") continue;
				matchedIds.add(row.clerkId);
				if (dryRun) continue;
				try {
					const current = await notion.readStudent(row.pageId);
					const duplicates = await notion.students({
						property: "Clerk User ID",
						rich_text: { equals: row.clerkId },
					});
					if (
						current.clerkId !== row.clerkId ||
						duplicates.length !== 1 ||
						duplicates[0].pageId !== row.pageId
					)
						throw new CrmFailure("identity_changed");
					// Refresh access immediately before sending, never send a queued old entitlement.
					const fresh: CrmMatch = await ctx.runQuery(
						internal.crmSyncState.inspectStudent,
						{ pageId: row.pageId, clerkId: row.clerkId, now: Date.now() },
					);
					if (fresh.status !== "matched")
						throw new CrmFailure("identity_changed");
					const link = {
						pageId: row.pageId,
						userId: fresh.projection.userId,
						clerkId: row.clerkId,
					};
					if (!(await ctx.runMutation(internal.crmSyncState.recordLink, link)))
						throw new CrmFailure("identity_changed");
					const now = Date.now();
					await notion.writeStudent(row.pageId, fresh.projection, now);
					if (
						!(await ctx.runMutation(internal.crmSyncState.recordLink, {
							...link,
							syncedAt: now,
						}))
					)
						throw new CrmFailure("identity_changed");
					counts.synced++;
				} catch (cause) {
					counts.failed++;
					const category =
						cause instanceof CrmFailure ? cause.category : "internal";
					await ctx.runMutation(internal.crmSyncState.recordLink, {
						pageId: row.pageId,
						userId: match.projection.userId,
						clerkId: row.clerkId,
						error: category,
					});
					if (category !== "identity_changed") throw new CrmFailure(category);
				}
			}
			await provisionSignups(ctx, notion, {
				runId,
				dataSourceId,
				dryRun,
				students,
				counts,
				matchedIds,
			});
			const presentPageIds = new Set(students.map((student) => student.pageId));
			let linkCursor: string | null = null;
			for (let pageNumber = 0; ; pageNumber++) {
				if (pageNumber >= 200) throw new CrmFailure("capacity");
				const links: {
					page: Array<{ linkId: Id<"crmStudentLinks">; pageId: string }>;
					isDone: boolean;
					continueCursor: string;
				} = await ctx.runQuery(internal.crmSyncState.linkedPages, {
					paginationOpts: { numItems: 100, cursor: linkCursor },
				});
				for (const link of links.page) {
					if (presentPageIds.has(link.pageId)) continue;
					if (
						dryRun ||
						(await ctx.runMutation(internal.crmSyncState.markMissingLink, {
							...link,
							runId,
						}))
					)
						counts.missingLinkedPages = (counts.missingLinkedPages ?? 0) + 1;
				}
				if (links.isDone) break;
				linkCursor = links.continueCursor;
			}
			let cursor: string | null = null;
			for (let pageNumber = 0; ; pageNumber++) {
				if (pageNumber >= 200) throw new CrmFailure("capacity");
				const result: {
					page: Array<{ clerkId: string; paid: boolean }>;
					isDone: boolean;
					continueCursor: string;
				} = await ctx.runQuery(internal.crmSyncState.paidUsers, {
					paginationOpts: { numItems: 100, cursor },
					now: Date.now(),
				});
				counts.paidWithoutCrm += result.page.filter(
					(user) => user.paid && !matchedIds.has(user.clerkId),
				).length;
				if (result.isDone) break;
				cursor = result.continueCursor;
			}
		} catch (cause) {
			error = cause instanceof CrmFailure ? cause.category : "internal";
		}
		await ctx.runMutation(internal.crmSyncState.finish, {
			runId,
			counts,
			...(error ? { error } : {}),
		});
		if (error || counts.failed)
			console.warn("CRM reconciliation requires attention", { counts, error });
		return {
			status:
				error || counts.failed ? ("failed" as const) : ("complete" as const),
			counts,
			...(error ? { error } : {}),
		};
	},
});
