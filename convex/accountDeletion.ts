import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
	env,
	internalMutation,
	internalQuery,
	mutation,
} from "./_generated/server";
import { getClerkIdentity, markClerkIdentityDeleted } from "./clerkIdentity";
import { throwUserFacingError } from "./errors";
import { deleteManagedFile } from "./fileStorage";

const DELETE_BATCH_SIZE = 25;
const REAUTHENTICATION_MAX_AGE_MINUTES = 10;
const DELETION_POLICY_VERSION = "DAY-357-approved-2026-10-18";
const COMPLETED_AUDIT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const AUDIT_PURGE_BATCH_SIZE = 100;

const deletionStageValidator = v.union(
	v.literal("revokeSessions"),
	v.literal("deleteClerkIdentity"),
	v.literal("deleteRevenueCat"),
	v.literal("deletePostHog"),
	v.literal("deleteData"),
	v.literal("deleteNotion"),
	v.literal("complete"),
);

const processorStatusValidator = v.union(
	v.literal("completed"),
	v.literal("notConfigured"),
);

const deletionRequestValidator = v.object({
	_id: v.id("accountDeletionRequests"),
	_creationTime: v.number(),
	requestId: v.string(),
	ownerTokenIdentifier: v.optional(v.string()),
	clerkUserId: v.optional(v.string()),
	status: v.union(
		v.literal("queued"),
		v.literal("processing"),
		v.literal("retryScheduled"),
		v.literal("manualReview"),
		v.literal("completed"),
	),
	stage: deletionStageValidator,
	attemptCount: v.number(),
	deletedRecords: v.number(),
	lastErrorCode: v.optional(v.string()),
	clerkStatus: v.optional(processorStatusValidator),
	revenueCatStatus: v.optional(processorStatusValidator),
	postHogStatus: v.optional(processorStatusValidator),
	crmDataSourceId: v.optional(v.string()),
	crmPageId: v.optional(v.string()),
	crmDeletionVerified: v.optional(v.boolean()),
	policyVersion: v.string(),
	requestedAt: v.number(),
	updatedAt: v.number(),
	nextAttemptAt: v.optional(v.number()),
	completedAt: v.optional(v.number()),
});

const reverificationRequired = () => ({
	clerk_error: {
		type: "forbidden" as const,
		reason: "reverification-error" as const,
		metadata: {
			reverification: {
				level: "first_factor" as const,
				afterMinutes: REAUTHENTICATION_MAX_AGE_MINUTES,
			},
		},
	},
});

export const assertAccountActive = async (
	ctx: QueryCtx | MutationCtx,
	ownerTokenIdentifier: string,
) => {
	if (
		(await getClerkIdentity(ctx, ownerTokenIdentifier))?.deletedAt !== undefined
	) {
		throwUserFacingError("Dieses Konto wird dauerhaft gelöscht.");
	}
	const deletionRequest = await ctx.db
		.query("accountDeletionRequests")
		.withIndex("by_ownerTokenIdentifier", (query) =>
			query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
		)
		.unique();
	if (deletionRequest) {
		throwUserFacingError("Dieses Konto wird dauerhaft gelöscht.");
	}
};

export const assertOwnerAccountActive = internalQuery({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		await assertAccountActive(ctx, identity.tokenIdentifier);
		return null;
	},
});

export const requestCurrentUserDeletion = mutation({
	args: {},
	returns: v.union(
		v.object({ status: v.literal("accepted"), requestId: v.string() }),
		v.object({
			clerk_error: v.object({
				type: v.literal("forbidden"),
				reason: v.literal("reverification-error"),
				metadata: v.object({
					reverification: v.object({
						level: v.literal("first_factor"),
						afterMinutes: v.number(),
					}),
				}),
			}),
		}),
	),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		// Legacy clients fail closed. Convex excludes fva from UserIdentity.
		return reverificationRequired();
	},
});

// Called only by the HTTP endpoint after Clerk verifies the current password.
// Identity is propagated from the authenticated HTTP context, never arguments.
export const enqueueVerifiedDeletion = internalMutation({
	args: {},
	returns: v.object({ status: v.literal("accepted"), requestId: v.string() }),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		const requestId = await enqueueDeletion(
			ctx,
			identity.tokenIdentifier,
			identity.subject,
			Date.now(),
			false,
		);
		return { status: "accepted" as const, requestId };
	},
});
async function enqueueDeletion(
	ctx: MutationCtx,
	ownerTokenIdentifier: string,
	clerkUserId: string,
	requestedAt: number,
	clerkAlreadyDeleted: boolean,
) {
	const tombstone = await getClerkIdentity(ctx, ownerTokenIdentifier);
	const existing = await ctx.db
		.query("accountDeletionRequests")
		.withIndex("by_ownerTokenIdentifier", (q) =>
			q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
		)
		.unique();
	if (tombstone?.deletedAt !== undefined && !existing)
		throwUserFacingError("Dieses Konto wurde bereits gelöscht.");
	await markClerkIdentityDeleted(
		ctx,
		ownerTokenIdentifier,
		clerkUserId,
		requestedAt,
	);
	if (existing) {
		if (
			clerkAlreadyDeleted &&
			["revokeSessions", "deleteClerkIdentity"].includes(existing.stage)
		) {
			await ctx.db.patch("accountDeletionRequests", existing._id, {
				stage: "deleteRevenueCat",
				clerkStatus: "completed",
				status: "queued",
				attemptCount: 0,
				nextAttemptAt: undefined,
				lastErrorCode: undefined,
			});
		}
		await ctx.scheduler.runAfter(
			0,
			internal.accountDeletionActions.processDeletionRequest,
			{ requestId: existing.requestId },
		);
		return existing.requestId;
	}
	const user = await ctx.db
		.query("users")
		.withIndex("by_tokenIdentifier", (q) =>
			q.eq("tokenIdentifier", ownerTokenIdentifier),
		)
		.unique();
	const links = user
		? await ctx.db
				.query("crmStudentLinks")
				.withIndex("by_userId", (q) => q.eq("userId", user._id))
				.take(2)
		: [];
	const requestId = crypto.randomUUID();
	await ctx.db.insert("accountDeletionRequests", {
		requestId,
		ownerTokenIdentifier,
		clerkUserId,
		requestedAt,
		updatedAt: Date.now(),
		status: "queued",
		stage: clerkAlreadyDeleted ? "deleteRevenueCat" : "revokeSessions",
		...(clerkAlreadyDeleted ? { clerkStatus: "completed" as const } : {}),
		attemptCount: 0,
		deletedRecords: 0,
		policyVersion: DELETION_POLICY_VERSION,
		crmDataSourceId: env.NOTION_CRM_DATA_SOURCE_ID,
		...(env.NOTION_CRM_DATA_SOURCE_ID && links.length === 1
			? { crmPageId: links[0].pageId }
			: {}),
	});
	await ctx.scheduler.runAfter(
		0,
		internal.accountDeletionActions.processDeletionRequest,
		{ requestId },
	);
	return requestId;
}
// Only a verified webhook or an explicit operator reconciliation calls this helper.
export const enqueueClerkDeletedAccount = (
	ctx: MutationCtx,
	tokenIdentifier: string,
	clerkId: string,
	deletedAt: number,
) => enqueueDeletion(ctx, tokenIdentifier, clerkId, deletedAt, true);
export const bindCrmCleanupPage = internalMutation({
	args: {
		requestId: v.string(),
		dataSourceId: v.string(),
		pageId: v.optional(v.string()),
		verified: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const request = await ctx.db
			.query("accountDeletionRequests")
			.withIndex("by_requestId", (q) => q.eq("requestId", args.requestId))
			.unique();
		if (
			!request ||
			request.stage !== "deleteNotion" ||
			request.crmDataSourceId !== args.dataSourceId ||
			(request.crmPageId && args.pageId && request.crmPageId !== args.pageId)
		)
			throw new Error("CRM identity changed");
		await ctx.db.patch("accountDeletionRequests", request._id, {
			...(args.pageId ? { crmPageId: args.pageId } : {}),
			...(args.verified ? { crmDeletionVerified: true } : {}),
		});
		return null;
	},
});
export const retryRequest = internalMutation({
	args: { requestId: v.string(), crmDataSourceId: v.optional(v.string()) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const request = await ctx.db
			.query("accountDeletionRequests")
			.withIndex("by_requestId", (q) => q.eq("requestId", args.requestId))
			.unique();
		if (!request || request.status !== "manualReview")
			throw new Error("Request is not awaiting review");
		if (
			args.crmDataSourceId &&
			(request.crmDataSourceId ||
				request.crmPageId ||
				args.crmDataSourceId !== env.NOTION_CRM_DATA_SOURCE_ID)
		)
			throw new Error("Existing cleanup destinations cannot be redirected");
		await ctx.db.patch("accountDeletionRequests", request._id, {
			status: "queued",
			attemptCount: 0,
			nextAttemptAt: undefined,
			lastErrorCode: undefined,
			...(args.crmDataSourceId
				? { crmDataSourceId: args.crmDataSourceId }
				: {}),
		});
		await ctx.scheduler.runAfter(
			0,
			internal.accountDeletionActions.processDeletionRequest,
			{ requestId: args.requestId },
		);
		return null;
	},
});

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

export const getRequestForProcessing = internalQuery({
	args: { requestId: v.string() },
	returns: v.union(deletionRequestValidator, v.null()),
	handler: async (ctx, args) =>
		ctx.db
			.query("accountDeletionRequests")
			.withIndex("by_requestId", (query) =>
				query.eq("requestId", args.requestId),
			)
			.unique(),
});

export const advanceRequestStage = internalMutation({
	args: {
		requestId: v.string(),
		expectedStage: deletionStageValidator,
		nextStage: deletionStageValidator,
		processor: v.optional(
			v.union(
				v.literal("clerk"),
				v.literal("revenueCat"),
				v.literal("postHog"),
			),
		),
		processorStatus: v.optional(
			v.union(v.literal("completed"), v.literal("notConfigured")),
		),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const request = await ctx.db
			.query("accountDeletionRequests")
			.withIndex("by_requestId", (query) =>
				query.eq("requestId", args.requestId),
			)
			.unique();
		if (
			!request ||
			request.stage !== args.expectedStage ||
			request.status === "completed"
		) {
			return false;
		}
		const processorPatch =
			args.processor === "clerk"
				? { clerkStatus: args.processorStatus }
				: args.processor === "revenueCat"
					? { revenueCatStatus: args.processorStatus }
					: args.processor === "postHog"
						? { postHogStatus: args.processorStatus }
						: {};
		await ctx.db.patch("accountDeletionRequests", request._id, {
			...processorPatch,
			status: "processing",
			stage: args.nextStage,
			lastErrorCode: undefined,
			nextAttemptAt: undefined,
			updatedAt: Date.now(),
		});
		return true;
	},
});

export const markRequestRetry = internalMutation({
	args: {
		requestId: v.string(),
		expectedStage: deletionStageValidator,
		errorCode: v.string(),
		nextAttemptAt: v.number(),
		shouldRetry: v.boolean(),
	},
	returns: v.object({ applied: v.boolean(), attemptCount: v.number() }),
	handler: async (ctx, args) => {
		const request = await ctx.db
			.query("accountDeletionRequests")
			.withIndex("by_requestId", (query) =>
				query.eq("requestId", args.requestId),
			)
			.unique();
		if (
			!request ||
			request.stage !== args.expectedStage ||
			request.status === "completed"
		) {
			return { applied: false, attemptCount: request?.attemptCount ?? 0 };
		}
		const attemptCount = request.attemptCount + 1;
		await ctx.db.patch("accountDeletionRequests", request._id, {
			attemptCount,
			status: args.shouldRetry ? "retryScheduled" : "manualReview",
			lastErrorCode: args.errorCode,
			nextAttemptAt: args.shouldRetry ? args.nextAttemptAt : undefined,
			updatedAt: Date.now(),
		});
		return { applied: true, attemptCount };
	},
});

export const completeRequest = internalMutation({
	args: { requestId: v.string() },
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const request = await ctx.db
			.query("accountDeletionRequests")
			.withIndex("by_requestId", (query) =>
				query.eq("requestId", args.requestId),
			)
			.unique();
		if (
			!request ||
			request.stage !== "deleteNotion" ||
			!request.crmDeletionVerified
		)
			return false;
		const now = Date.now();
		if (!request.ownerTokenIdentifier) return false;
		const barrier = await getClerkIdentity(ctx, request.ownerTokenIdentifier);
		if (!barrier || barrier.deletedAt === undefined) {
			throw new Error("Deletion replay barrier is missing");
		}
		await ctx.db.patch("clerkIdentities", barrier._id, {
			deletionCompletedAt: now,
		});
		await ctx.db.patch("accountDeletionRequests", request._id, {
			ownerTokenIdentifier: undefined,
			clerkUserId: undefined,
			crmDataSourceId: undefined,
			crmPageId: undefined,
			status: "completed",
			stage: "complete",
			lastErrorCode: undefined,
			nextAttemptAt: undefined,
			completedAt: now,
			updatedAt: now,
		});
		return true;
	},
});

/** Expire successful audits only; unresolved failures keep their recovery context. */
export const purgeCompletedAudits = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const expired = await ctx.db
			.query("accountDeletionRequests")
			.withIndex("by_status_and_completedAt", (query) =>
				query
					.eq("status", "completed")
					.gte("completedAt", 0)
					.lte("completedAt", Date.now() - COMPLETED_AUDIT_RETENTION_MS),
			)
			.take(AUDIT_PURGE_BATCH_SIZE);
		for (const request of expired) {
			await ctx.db.delete("accountDeletionRequests", request._id);
		}
		if (expired.length === AUDIT_PURGE_BATCH_SIZE) {
			await ctx.scheduler.runAfter(
				0,
				internal.accountDeletion.purgeCompletedAudits,
				{},
			);
		}
		return expired.length;
	},
});

export const deleteOwnerDataBatch = internalMutation({
	args: { requestId: v.string() },
	returns: v.object({
		deletedRecords: v.number(),
		done: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const deletionRequest = await ctx.db
			.query("accountDeletionRequests")
			.withIndex("by_requestId", (query) =>
				query.eq("requestId", args.requestId),
			)
			.unique();
		if (
			!deletionRequest?.ownerTokenIdentifier ||
			deletionRequest.stage !== "deleteData" ||
			deletionRequest.status === "completed"
		) {
			return { deletedRecords: 0, done: true };
		}

		const ownerTokenIdentifier = deletionRequest.ownerTokenIdentifier;
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

		const personalSubjectReferences = await ctx.db
			.query("personalSubjectReferences")
			.withIndex("by_ownerTokenIdentifier_and_personalSubjectId", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"personalSubjectReferences",
			personalSubjectReferences,
		);

		const personalSubjects = await ctx.db
			.query("personalSubjects")
			.withIndex("by_ownerTokenIdentifier_and_normalizedName", (query) =>
				query.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"personalSubjects",
			personalSubjects,
		);

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

		const recordedValidationAttributions = await ctx.db
			.query("validationAttributions")
			.withIndex("by_recordedByTokenIdentifier", (query) =>
				query.eq("recordedByTokenIdentifier", ownerTokenIdentifier),
			)
			.take(DELETE_BATCH_SIZE);
		deletedRecords += await deleteRows(
			ctx,
			"validationAttributions",
			recordedValidationAttributions,
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
			const crmSignups = await ctx.db
				.query("crmStudentSignups")
				.withIndex("by_userId", (q) => q.eq("userId", user._id))
				.take(DELETE_BATCH_SIZE);
			deletedRecords += await deleteRows(ctx, "crmStudentSignups", crmSignups);
			const crmLinks = await ctx.db
				.query("crmStudentLinks")
				.withIndex("by_userId", (q) => q.eq("userId", user._id))
				.take(DELETE_BATCH_SIZE);
			deletedRecords += await deleteRows(ctx, "crmStudentLinks", crmLinks);
			const crmUpdates = await ctx.db
				.query("crmStudentUpdates")
				.withIndex("by_userId", (q) => q.eq("userId", user._id))
				.take(DELETE_BATCH_SIZE);
			deletedRecords += await deleteRows(ctx, "crmStudentUpdates", crmUpdates);
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
			await ctx.db.patch("accountDeletionRequests", deletionRequest._id, {
				deletedRecords: deletionRequest.deletedRecords + deletedRecords,
				status: "processing",
				updatedAt: Date.now(),
			});
			return { deletedRecords, done: false };
		}

		if (user) {
			await ctx.db.delete("users", user._id);
			deletedRecords += 1;
		}
		if (deletedRecords > 0) {
			await ctx.db.patch("accountDeletionRequests", deletionRequest._id, {
				deletedRecords: deletionRequest.deletedRecords + deletedRecords,
				updatedAt: Date.now(),
			});
		}

		return { deletedRecords, done: true };
	},
});
