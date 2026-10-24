import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/** Called in the scheduling transaction: failed saves must not count as recovery. */
export async function recordReminderReplanned(
	ctx: MutationCtx,
	ownerTokenIdentifier: string,
	dayEntryId: Id<"dayEntries"> | undefined,
) {
	if (!dayEntryId) return;
	const reminder = await ctx.db
		.query("notificationHistory")
		.withIndex("by_ownerTokenIdentifier_and_eventKey", (q) =>
			q
				.eq("ownerTokenIdentifier", ownerTokenIdentifier)
				.eq("eventKey", `forgotten:${dayEntryId}`),
		)
		.unique();
	if (
		reminder?.openedAt !== undefined &&
		reminder.rescheduledAt === undefined
	) {
		await ctx.db.patch("notificationHistory", reminder._id, {
			rescheduledAt: Date.now(),
		});
	}
}
