import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { CrmCounts, CrmMatch } from "./crmContract";
import {
	CRM_MAX_STUDENTS,
	CrmFailure,
	type createNotionClient,
	type StudentRow,
} from "./crmNotion";

// Called only inside the reconciliation lease: signup deliveries and scheduled
// sweeps share a single writer, including their Notion rate limit budget.
export async function provisionSignups(
	ctx: ActionCtx,
	notion: ReturnType<typeof createNotionClient>,
	options: {
		runId: string;
		dataSourceId: string;
		dryRun: boolean;
		students: StudentRow[];
		counts: CrmCounts;
		matchedIds: Set<string>;
	},
) {
	const pending = await ctx.runQuery(internal.crmSignupState.pending, {});
	if (!pending.length) return;
	await notion.checkCreationSchema();
	const { counts } = options;
	counts.created = 0;
	counts.wouldCreate = 0;
	counts.creationReview = 0;
	let size = options.students.length;
	const reservedEmails = new Set(
		options.students.map((row) => row.email?.toLowerCase()),
	);
	for (const signupId of pending) {
		const user = await ctx.runQuery(internal.crmSignupState.inspect, {
			signupId,
		});
		if (!user) {
			if (!options.dryRun)
				await ctx.runMutation(internal.crmSignupState.finish, { signupId });
			continue;
		}
		const review = async () => {
			counts.creationReview = (counts.creationReview ?? 0) + 1;
			if (!options.dryRun)
				await ctx.runMutation(internal.crmSignupState.finish, {
					signupId,
					error: "identity_changed",
				});
		};
		if (
			user.conflict ||
			(user.dataSourceId && user.dataSourceId !== options.dataSourceId)
		) {
			await review();
			continue;
		}
		const existing = await notion.students({
			property: "Clerk User ID",
			rich_text: { equals: user.clerkId },
		});
		if (
			existing.length > 1 ||
			(user.linkedPageId && existing[0]?.pageId !== user.linkedPageId)
		) {
			await review();
			continue;
		}
		if (existing.length === 1) {
			const fresh = await notion.readStudent(existing[0].pageId);
			if (fresh.clerkId !== user.clerkId) {
				await review();
				continue;
			}
			if (!options.dryRun) {
				const linked = await ctx.runMutation(internal.crmSyncState.recordLink, {
					pageId: fresh.pageId,
					userId: user.userId,
					clerkId: user.clerkId,
				});
				if (!linked) {
					await review();
					continue;
				}
				await ctx.runMutation(internal.crmSignupState.finish, { signupId });
			}
			continue;
		}
		// A lost response may hide a successful POST. A missing search result is
		// not proof that creation failed; do not resend, even after a worker crash.
		if (user.attemptedAt !== undefined) {
			await review();
			continue;
		}
		const email = user.email.trim().toLowerCase();
		const collision =
			reservedEmails.has(email) ||
			(await notion.students({ property: "Email", email: { equals: email } }))
				.length > 0;
		if (collision) {
			await review();
			continue;
		}
		const match: CrmMatch = await ctx.runQuery(
			internal.crmSyncState.inspectStudent,
			{
				pageId: "new-signup",
				clerkId: user.clerkId,
				now: Date.now(),
			},
		);
		if (match.status !== "matched") {
			await review();
			continue;
		}
		if (size >= CRM_MAX_STUDENTS) throw new CrmFailure("capacity");
		if (options.dryRun) {
			counts.wouldCreate++;
			size++;
			reservedEmails.add(email);
			continue;
		}
		if (
			!(await ctx.runMutation(internal.crmSignupState.markAttempt, {
				signupId,
				runId: options.runId,
				dataSourceId: options.dataSourceId,
				clerkId: user.clerkId,
				email: user.email,
			}))
		) {
			await review();
			continue;
		}
		const now = Date.now();
		const created = await notion.createStudent(
			user.clerkId,
			user.email,
			user.name,
			match.projection,
			now,
		);
		if (created.clerkId !== user.clerkId)
			throw new CrmFailure("identity_changed");
		size++;
		options.students.push(created);
		reservedEmails.add(email);
		counts.created++;
		if (
			!(await ctx.runMutation(internal.crmSyncState.recordLink, {
				pageId: created.pageId,
				userId: user.userId,
				clerkId: user.clerkId,
				syncedAt: now,
			}))
		) {
			await review();
			continue;
		}
		await ctx.runMutation(internal.crmSignupState.finish, { signupId });
		options.matchedIds.add(user.clerkId);
	}
}
