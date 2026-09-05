import { v } from "convex/values";
import type { Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation } from "./_generated/server";
import { throwUserFacingError } from "./errors";
import { deleteManagedFile } from "./fileStorage";

const DELETE_BATCH_SIZE = 25;

const deleteRows = async <TableName extends TableNames>(
	ctx: MutationCtx,
	tableName: TableName,
	rows: Array<{ _id: Id<TableName> }>,
) => {
	for (const row of rows) {
		await ctx.db.delete(tableName, row._id);
	}
	return rows.length;
};

export const deleteCurrentUserDataBatch = mutation({
	args: {},
	returns: v.object({
		deletedRecords: v.number(),
		done: v.boolean(),
	}),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throwUserFacingError("Nicht authentifiziert.");
		}

		const ownerTokenIdentifier = identity.tokenIdentifier;
		const user = await ctx.db
			.query("users")
			.withIndex("by_tokenIdentifier", (query) =>
				query.eq("tokenIdentifier", ownerTokenIdentifier),
			)
			.unique();
		let deletedRecords = 0;

		const learningPlanDocuments = await ctx.db
			.query("learningPlanDocuments")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		for (const document of learningPlanDocuments) {
			await deleteManagedFile(ctx, {
				storageId: document.storageId,
				storageProvider: document.storageProvider,
			});
			await ctx.db.delete("learningPlanDocuments", document._id);
			deletedRecords += 1;
		}

		const timetableDocuments = await ctx.db
			.query("timetableDocuments")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		for (const document of timetableDocuments) {
			await deleteManagedFile(ctx, {
				storageId: document.storageId,
				storageProvider: document.storageProvider,
			});
			await ctx.db.delete("timetableDocuments", document._id);
			deletedRecords += 1;
		}

		const learningSessionAnswerAttempts = await ctx.db
			.query("learningSessionAnswerAttempts")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"learningSessionAnswerAttempts",
			learningSessionAnswerAttempts,
		);

		const learningSessionAnalyses = await ctx.db
			.query("learningSessionAnalyses")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"learningSessionAnalyses",
			learningSessionAnalyses,
		);

		const learningSessionContentItems = await ctx.db
			.query("learningSessionContentItems")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"learningSessionContentItems",
			learningSessionContentItems,
		);

		const learningPlanSessions = await ctx.db
			.query("learningPlanSessions")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"learningPlanSessions",
			learningPlanSessions,
		);

		const learningPlanAnswers = await ctx.db
			.query("learningPlanAnswers")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"learningPlanAnswers",
			learningPlanAnswers,
		);

		const learningPlanAiUsage = await ctx.db
			.query("learningPlanAiUsage")
			.withIndex("by_ownerTokenIdentifier_and_createdAt", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"learningPlanAiUsage",
			learningPlanAiUsage,
		);

		const learningPlanAiBudgetReservations = await ctx.db
			.query("learningPlanAiBudgetReservations")
			.withIndex("by_ownerTokenIdentifier_and_monthStart", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"learningPlanAiBudgetReservations",
			learningPlanAiBudgetReservations,
		);

		const dayEntries = await ctx.db
			.query("dayEntries")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(ctx, "dayEntries", dayEntries);

		const learningPlans = await ctx.db
			.query("learningPlans")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(ctx, "learningPlans", learningPlans);

		const timetableLessons = await ctx.db
			.query("timetableLessons")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"timetableLessons",
			timetableLessons,
		);

		const timetables = await ctx.db
			.query("timetables")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(ctx, "timetables", timetables);

		const localNotificationSchedules = await ctx.db
			.query("localNotificationSchedules")
			.withIndex("by_ownerTokenIdentifier_and_expiresAt", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"localNotificationSchedules",
			localNotificationSchedules,
		);

		const notificationHistory = await ctx.db
			.query("notificationHistory")
			.withIndex("by_ownerTokenIdentifier_and_createdAt", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"notificationHistory",
			notificationHistory,
		);

		const notificationPreferences = await ctx.db
			.query("notificationPreferences")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"notificationPreferences",
			notificationPreferences,
		);

		const userLearningTimes = await ctx.db
			.query("userLearningTimes")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"userLearningTimes",
			userLearningTimes,
		);

		const validationAttributions = await ctx.db
			.query("validationAttributions")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"validationAttributions",
			validationAttributions,
		);

		const validationUserStates = await ctx.db
			.query("validationUserStates")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"validationUserStates",
			validationUserStates,
		);

		const accessEntitlements = await ctx.db
			.query("accessEntitlements")
			.withIndex("by_ownerTokenIdentifier", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"accessEntitlements",
			accessEntitlements,
		);

		if (user) {
			const userOnboardingAnswers = await ctx.db
				.query("userOnboardingAnswers")
				.withIndex("by_userId", (query) => query.eq("userId", user._id))
				.take(DELETE_BATCH_SIZE);
			deletedRecords += await deleteRows(
				ctx,
				"userOnboardingAnswers",
				userOnboardingAnswers,
			);
		}

		if (deletedRecords > 0) {
			return { deletedRecords, done: false };
		}

		if (user) {
			await ctx.db.delete("users", user._id);
			deletedRecords += 1;
		}

		return { deletedRecords, done: true };
	},
});
