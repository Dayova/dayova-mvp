import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { env, internalAction } from "./_generated/server";
import { type CrmError, emptyCounts } from "./crmContract";
import { CrmFailure, createNotionClient } from "./crmNotion";

// Runs after app data deletion. The request retains the exact destination and
// page through retries, including a lost response after clearing the Clerk ID.
export const reconcile = internalAction({
	args: { requestId: v.string() },
	returns: v.union(v.literal("complete"), v.literal("busy")),
	handler: async (ctx, args) => {
		const request = await ctx.runQuery(
			internal.accountDeletion.getRequestForProcessing,
			args,
		);
		if (
			!request ||
			request.stage !== "deleteNotion" ||
			request.crmDeletionVerified
		)
			return "complete";
		const source = env.NOTION_CRM_DATA_SOURCE_ID;
		if (
			env.NOTION_CRM_DELETION_MODE !== "live" ||
			!source ||
			!env.NOTION_CRM_TOKEN ||
			request.crmDataSourceId !== source ||
			!request.clerkUserId
		)
			throw new ConvexError({ code: "configuration" });
		const runId = crypto.randomUUID();
		if (
			!(await ctx.runMutation(internal.crmSyncState.begin, {
				runId,
				dataSourceId: source,
				mode: "cleanup",
				countAsAudit: false,
			}))
		)
			return "busy";
		let error: CrmError | undefined;
		// Notion date readback can discard seconds/milliseconds. Persist a marker
		// that is stable at the destination's minute precision from the outset.
		const deletedAt = Math.floor(request.requestedAt / 60_000) * 60_000;
		try {
			const notion = createNotionClient(env.NOTION_CRM_TOKEN, source);
			await notion.checkSchema(true);
			const matches = await notion.students({
				property: "Clerk User ID",
				rich_text: { equals: request.clerkUserId },
			});
			if (
				matches.length > 1 ||
				(request.crmPageId &&
					matches.length &&
					matches[0].pageId !== request.crmPageId)
			)
				throw new CrmFailure("identity_changed");
			const pageId = request.crmPageId ?? matches[0]?.pageId;
			if (pageId) {
				await ctx.runMutation(internal.accountDeletion.bindCrmCleanupPage, {
					requestId: args.requestId,
					dataSourceId: source,
					pageId,
				});
				const current = await notion.readStudent(pageId);
				const alreadyCleared =
					!current.clerkId &&
					current.appAccountStatus === "deleted" &&
					current.appAccountDeletedAt === deletedAt;
				if (!alreadyCleared) {
					if (current.clerkId !== request.clerkUserId || matches.length !== 1)
						throw new CrmFailure("identity_changed");
					await notion.clearStudentAccount(pageId, deletedAt);
				}
				const verified = await notion.readStudent(pageId);
				if (
					verified.clerkId ||
					verified.appAccountStatus !== "deleted" ||
					verified.appAccountDeletedAt !== deletedAt
				)
					throw new CrmFailure("identity_changed");
			}
			await ctx.runMutation(internal.accountDeletion.bindCrmCleanupPage, {
				requestId: args.requestId,
				dataSourceId: source,
				pageId,
				verified: true,
			});
			return "complete";
		} catch (cause) {
			error = cause instanceof CrmFailure ? cause.category : "internal";
			throw new ConvexError({ code: error });
		} finally {
			const counts = emptyCounts();
			if (error) counts.failed = 1;
			await ctx.runMutation(internal.crmSyncState.finish, {
				runId,
				counts,
				error,
				countAsAudit: false,
			});
		}
	},
});
