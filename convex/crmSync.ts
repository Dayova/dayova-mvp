import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { env, internalAction } from "./_generated/server";
import {
	type CrmCounts,
	type CrmError,
	type CrmMatch,
	crmCounts,
	crmError,
	emptyCounts,
} from "./crmContract";
import { CrmFailure, createNotionClient, type StudentRow } from "./crmNotion";
import { crmProjectionHash } from "./crmProjectionHash";
import { provisionSignups } from "./crmSignup";

export const reconcile = internalAction({
	args: {
		dryRun: v.optional(v.boolean()),
		updatesOnly: v.optional(v.boolean()),
	},
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
	handler: async (
		ctx,
		args,
	): Promise<{
		status: "disabled" | "busy" | "complete" | "failed";
		counts: CrmCounts;
		error?: CrmError;
	}> => {
		const counts = emptyCounts();
		const mode = env.NOTION_CRM_MODE ?? "off";
		if (args.updatesOnly && mode !== "live")
			return { status: "disabled" as const, counts };
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
			countAsAudit: !args.updatesOnly,
		});
		if (!started) return { status: "busy" as const, counts };
		let error: CrmError | undefined;
		try {
			const notion = createNotionClient(env.NOTION_CRM_TOKEN, dataSourceId);
			await notion.checkSchema(!dryRun);
			let inventory: StudentRow[] | undefined;
			const fullInventory = async () => {
				inventory ??= await notion.students();
				return inventory;
			};
			if (args.updatesOnly) {
				const updates = await ctx.runQuery(internal.crmUpdates.due, {
					now: Date.now(),
				});
				counts.total = updates.length;
				for (const update of updates) {
					let updateError: CrmError | undefined;
					try {
						const target = await ctx.runQuery(internal.crmUpdates.target, {
							userId: update.userId,
						});
						if (!target) continue;
						if (target.conflict) throw new CrmFailure("identity_changed");
						const matches = await notion.students({
							property: "Clerk User ID",
							rich_text: { equals: target.clerkId },
						});
						if (
							matches.length > 1 ||
							(target.linkedPageId &&
								matches[0]?.pageId !== target.linkedPageId)
						)
							throw new CrmFailure("identity_changed");
						if (!matches.length) {
							counts.unmatched++;
							continue;
						}
						const row = await notion.readStudent(matches[0].pageId);
						if (row.clerkId !== target.clerkId)
							throw new CrmFailure("identity_changed");
						const match: CrmMatch = await ctx.runQuery(
							internal.crmSyncState.inspectStudent,
							{ pageId: row.pageId, clerkId: row.clerkId, now: Date.now() },
						);
						if (match.status !== "matched")
							throw new CrmFailure("identity_changed");
						if (!match.projection.email.trim())
							throw new CrmFailure("identity_changed");
						const projectionHash = await crmProjectionHash(match.projection);
						if (
							match.lastProjectionHash === projectionHash &&
							!match.linkError &&
							row.email?.toLowerCase() ===
								match.projection.email.toLowerCase() &&
							(!row.lastEditedAt ||
								row.lastEditedAt === match.lastNotionEditedAt)
						) {
							counts.matched++;
							continue;
						}
						if (
							row.email?.toLowerCase() !== match.projection.email.toLowerCase()
						) {
							const allStudents = await fullInventory();
							if (
								allStudents.some(
									(student) =>
										student.pageId !== row.pageId &&
										student.email?.toLowerCase() ===
											match.projection.email.toLowerCase(),
								)
							)
								throw new CrmFailure("identity_changed");
							const emailMatches = await notion.students({
								property: "Email",
								email: { equals: match.projection.email },
							});
							if (emailMatches.some((student) => student.pageId !== row.pageId))
								throw new CrmFailure("identity_changed");
						}
						const link = {
							pageId: row.pageId,
							userId: update.userId,
							clerkId: row.clerkId,
						};
						if (
							!(await ctx.runMutation(internal.crmSyncState.recordLink, link))
						)
							throw new CrmFailure("identity_changed");
						const now = Date.now();
						const notionEditedAt = await notion.writeStudent(
							row.pageId,
							match.projection,
							now,
						);
						if (
							!(await ctx.runMutation(internal.crmSyncState.recordLink, {
								...link,
								syncedAt: now,
								projectionHash,
								...(notionEditedAt ? { notionEditedAt } : {}),
							}))
						)
							throw new CrmFailure("identity_changed");
						counts.matched++;
						counts.synced++;
					} catch (cause) {
						updateError =
							cause instanceof CrmFailure ? cause.category : "internal";
						counts.failed++;
					} finally {
						await ctx.runMutation(internal.crmUpdates.finish, {
							updateId: update.updateId,
							revision: update.revision,
							...(updateError ? { error: updateError } : {}),
						});
					}
				}
				await ctx.runMutation(internal.crmSyncState.finish, {
					runId,
					counts,
					countAsAudit: false,
				});
				if (
					(await ctx.runQuery(internal.crmUpdates.due, { now: Date.now() }))
						.length
				)
					await ctx.scheduler.runAfter(1000, internal.crmSync.reconcile, {
						updatesOnly: true,
					});
				else if (
					(await ctx.runQuery(internal.crmSyncState.status, {}))?.auditPhase
				)
					await ctx.scheduler.runAfter(1000, internal.crmSync.reconcile, {});
				return {
					status: counts.failed ? ("failed" as const) : ("complete" as const),
					counts,
				};
			}
			const progress = dryRun
				? { phase: "students" as const, cursor: null, failed: 0 }
				: await ctx.runQuery(internal.crmSyncState.auditProgress, {});
			const finishBatch = async (
				nextPhase?: "students" | "links" | "paid",
				nextCursor?: string,
			) => {
				await ctx.runMutation(internal.crmSyncState.finish, {
					runId,
					counts,
					...(nextPhase ? { nextPhase } : {}),
					...(nextCursor ? { nextCursor } : {}),
				});
				if (nextPhase) {
					const pending = await ctx.runQuery(internal.crmUpdates.due, {
						now: Date.now(),
					});
					await ctx.scheduler.runAfter(
						1000,
						internal.crmSync.reconcile,
						pending.length ? { updatesOnly: true } : {},
					);
				}
				return {
					status:
						progress.failed + counts.failed > 0
							? ("failed" as const)
							: ("complete" as const),
					counts,
				};
			};
			if (!dryRun && progress.phase === "links") {
				const links = await ctx.runQuery(internal.crmSyncState.linkedPages, {
					paginationOpts: { numItems: 25, cursor: progress.cursor },
				});
				for (const link of links.page) {
					try {
						const student = await notion.readStudent(link.pageId);
						const target = await ctx.runQuery(internal.crmUpdates.target, {
							userId: link.userId,
						});
						if (
							!target ||
							target.conflict ||
							student.pageId !== link.pageId ||
							student.clerkId !== target.clerkId
						)
							throw new CrmFailure("identity_changed");
					} catch (cause) {
						if (
							!(cause instanceof CrmFailure) ||
							cause.category !== "identity_changed"
						)
							throw cause;
						if (
							await ctx.runMutation(internal.crmSyncState.markMissingLink, {
								linkId: link.linkId,
								pageId: link.pageId,
								runId,
							})
						)
							counts.missingLinkedPages = (counts.missingLinkedPages ?? 0) + 1;
					}
				}
				return finishBatch(
					links.isDone ? "paid" : "links",
					links.isDone ? undefined : links.continueCursor,
				);
			}
			if (!dryRun && progress.phase === "paid") {
				const users = await ctx.runQuery(internal.crmSyncState.paidUsers, {
					paginationOpts: { numItems: 100, cursor: progress.cursor },
					now: Date.now(),
				});
				counts.paidWithoutCrm = users.page.filter(
					(user) => user.paid && !user.hasLinkedCrm,
				).length;
				return finishBatch(
					users.isDone ? undefined : "paid",
					users.isDone ? undefined : users.continueCursor,
				);
			}
			const page = dryRun
				? { rows: await fullInventory(), nextCursor: undefined }
				: await notion.studentsPage({
						cursor: progress.cursor ?? undefined,
						pageSize: 25,
					});
			const students = page.rows;
			counts.total = students.length;
			const matchedIds = new Set<string>();
			if (
				!dryRun &&
				(await ctx.runQuery(internal.crmSignupState.pending, {})).length
			) {
				// Signups need a complete collision inventory; ordinary profile audits do not.
				const signupInventory = await fullInventory();
				await provisionSignups(ctx, notion, {
					runId,
					dataSourceId,
					dryRun,
					students: signupInventory,
					counts,
					matchedIds,
				});
			}
			const idCounts = new Map<string, number>();
			for (const row of students)
				if (row.clerkId)
					idCounts.set(row.clerkId, (idCounts.get(row.clerkId) ?? 0) + 1);
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
					if (!fresh.projection.email.trim())
						throw new CrmFailure("identity_changed");
					const projectionHash = await crmProjectionHash(fresh.projection);
					if (
						fresh.lastProjectionHash === projectionHash &&
						!fresh.linkError &&
						current.email?.toLowerCase() ===
							fresh.projection.email.toLowerCase() &&
						(!current.lastEditedAt ||
							current.lastEditedAt === fresh.lastNotionEditedAt)
					)
						continue;
					if (
						current.email?.toLowerCase() !==
						fresh.projection.email.toLowerCase()
					) {
						const allStudents = await fullInventory();
						if (
							allStudents.some(
								(student) =>
									student.pageId !== row.pageId &&
									student.email?.toLowerCase() ===
										fresh.projection.email.toLowerCase(),
							)
						)
							throw new CrmFailure("identity_changed");
						const emailMatches = await notion.students({
							property: "Email",
							email: { equals: fresh.projection.email },
						});
						if (emailMatches.some((student) => student.pageId !== row.pageId))
							throw new CrmFailure("identity_changed");
					}
					const link = {
						pageId: row.pageId,
						userId: fresh.projection.userId,
						clerkId: row.clerkId,
					};
					if (!(await ctx.runMutation(internal.crmSyncState.recordLink, link)))
						throw new CrmFailure("identity_changed");
					const now = Date.now();
					const notionEditedAt = await notion.writeStudent(
						row.pageId,
						fresh.projection,
						now,
					);
					if (
						!(await ctx.runMutation(internal.crmSyncState.recordLink, {
							...link,
							syncedAt: now,
							projectionHash,
							...(notionEditedAt ? { notionEditedAt } : {}),
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
			if (dryRun)
				await provisionSignups(ctx, notion, {
					runId,
					dataSourceId,
					dryRun,
					students,
					counts,
					matchedIds,
				});
			if (!dryRun)
				return finishBatch(
					page.nextCursor ? "students" : "links",
					page.nextCursor,
				);
			const presentPageIds = new Set(students.map((student) => student.pageId));
			let linkCursor: string | null = null;
			for (;;) {
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
			for (;;) {
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
			countAsAudit: !args.updatesOnly,
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
