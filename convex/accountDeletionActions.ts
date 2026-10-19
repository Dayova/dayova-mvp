"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { readOptionalEnv } from "./env";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRY_ATTEMPTS = 8;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 60 * 60_000];

type DeletionStage =
	| "revokeSessions"
	| "deleteClerkIdentity"
	| "deleteRevenueCat"
	| "deletePostHog"
	| "deleteData"
	| "deleteNotion"
	| "complete";

class ProcessorError extends Error {
	constructor(readonly code: string) {
		super(code);
	}
}

const fetchForDeletion = async (
	url: string,
	init: RequestInit,
	acceptedStatuses: number[] = [],
) => {
	let response: Response;
	try {
		response = await fetch(url, {
			...init,
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
	} catch {
		throw new ProcessorError("network_or_timeout");
	}
	if (!response.ok && !acceptedStatuses.includes(response.status)) {
		throw new ProcessorError(`http_${response.status}`);
	}
	return response;
};

const clerkHeaders = (secretKey: string) => ({
	Authorization: `Bearer ${secretKey}`,
	"Content-Type": "application/json",
});

const revokeClerkSessions = async (clerkUserId: string, secretKey: string) => {
	const response = await fetchForDeletion(
		`https://api.clerk.com/v1/sessions?user_id=${encodeURIComponent(clerkUserId)}&status=active&limit=500`,
		{ headers: clerkHeaders(secretKey) },
	);
	const payload: unknown = await response.json().catch(() => null);
	const sessions = Array.isArray(payload)
		? payload
		: payload && typeof payload === "object" && "data" in payload
			? (payload as { data?: unknown }).data
			: null;
	if (!Array.isArray(sessions)) throw new ProcessorError("invalid_response");
	for (const session of sessions) {
		if (!session || typeof session !== "object" || !("id" in session)) continue;
		const sessionId = (session as { id?: unknown }).id;
		if (typeof sessionId !== "string") continue;
		await fetchForDeletion(
			`https://api.clerk.com/v1/sessions/${encodeURIComponent(sessionId)}/revoke`,
			{ method: "POST", headers: clerkHeaders(secretKey) },
			[404],
		);
	}
};

const deleteClerkIdentity = async (clerkUserId: string, secretKey: string) => {
	await fetchForDeletion(
		`https://api.clerk.com/v1/users/${encodeURIComponent(clerkUserId)}`,
		{ method: "DELETE", headers: clerkHeaders(secretKey) },
		[404],
	);
};

const deleteRevenueCatCustomer = async (
	appUserId: string,
	secretApiKey: string,
) => {
	await fetchForDeletion(
		`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
		{
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${secretApiKey}`,
				Accept: "application/json",
			},
		},
		[404],
	);
};

const deletePostHogPerson = async (
	distinctId: string,
	personalApiKey: string,
	projectId: string,
	host: string,
) => {
	const baseUrl = host.replace(/\/$/, "");
	const headers = { Authorization: `Bearer ${personalApiKey}` };
	const response = await fetchForDeletion(
		`${baseUrl}/api/projects/${encodeURIComponent(projectId)}/persons/?distinct_id=${encodeURIComponent(distinctId)}`,
		{ headers },
	);
	const payload: unknown = await response.json().catch(() => null);
	const results =
		payload && typeof payload === "object" && "results" in payload
			? (payload as { results?: unknown }).results
			: null;
	if (!Array.isArray(results)) throw new ProcessorError("invalid_response");
	for (const person of results) {
		if (!person || typeof person !== "object" || !("id" in person)) continue;
		const personId = (person as { id?: unknown }).id;
		if (typeof personId !== "string") continue;
		await fetchForDeletion(
			`${baseUrl}/api/projects/${encodeURIComponent(projectId)}/persons/${encodeURIComponent(personId)}/?delete_events=true&delete_recordings=true`,
			{ method: "DELETE", headers },
			[404],
		);
	}
};

const errorCodeFor = (stage: DeletionStage, error: unknown) =>
	`${stage}_${
		error instanceof ProcessorError
			? error.code
			: error instanceof ConvexError &&
					error.data &&
					typeof error.data === "object" &&
					"code" in error.data &&
					typeof error.data.code === "string" &&
					[
						"configuration",
						"schema",
						"unauthorized",
						"unavailable",
						"rate_limited",
						"identity_changed",
						"capacity",
						"timeout",
						"internal",
					].includes(error.data.code)
				? error.data.code
				: "unexpected"
	}`;

export const processDeletionRequest = internalAction({
	args: { requestId: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const request = await ctx.runMutation(
			internal.accountDeletion.prepareRequestForProcessing,
			args,
		);
		if (
			!request ||
			request.status === "completed" ||
			request.status === "manualReview" ||
			(request.nextAttemptAt !== undefined &&
				request.nextAttemptAt > Date.now()) ||
			request.stage === "complete"
		) {
			return null;
		}

		const stage = request.stage;
		try {
			let advanced = false;
			if (stage === "revokeSessions") {
				const secretKey = readOptionalEnv("CLERK_SECRET_KEY");
				if (!secretKey || !request.clerkUserId) {
					throw new ProcessorError("configuration_missing");
				}
				await revokeClerkSessions(request.clerkUserId, secretKey);
				advanced = await ctx.runMutation(
					internal.accountDeletion.advanceRequestStage,
					{
						requestId: args.requestId,
						expectedStage: stage,
						nextStage: "deleteClerkIdentity",
					},
				);
			} else if (stage === "deleteClerkIdentity") {
				const secretKey = readOptionalEnv("CLERK_SECRET_KEY");
				if (!secretKey || !request.clerkUserId) {
					throw new ProcessorError("configuration_missing");
				}
				await deleteClerkIdentity(request.clerkUserId, secretKey);
				advanced = await ctx.runMutation(
					internal.accountDeletion.advanceRequestStage,
					{
						requestId: args.requestId,
						expectedStage: stage,
						nextStage: "deleteRevenueCat",
						processor: "clerk",
						processorStatus: "completed",
					},
				);
			} else if (stage === "deleteRevenueCat") {
				const secretApiKey = readOptionalEnv("REVENUECAT_SECRET_API_KEY");
				if (secretApiKey && request.clerkUserId) {
					await deleteRevenueCatCustomer(request.clerkUserId, secretApiKey);
				}
				advanced = await ctx.runMutation(
					internal.accountDeletion.advanceRequestStage,
					{
						requestId: args.requestId,
						expectedStage: stage,
						nextStage: "deletePostHog",
						processor: "revenueCat",
						processorStatus: secretApiKey ? "completed" : "notConfigured",
					},
				);
			} else if (stage === "deletePostHog") {
				const personalApiKey = readOptionalEnv("POSTHOG_PERSONAL_API_KEY");
				const projectId = readOptionalEnv("POSTHOG_PROJECT_ID");
				const host =
					readOptionalEnv("POSTHOG_API_HOST") ?? "https://eu.posthog.com";
				if (Boolean(personalApiKey) !== Boolean(projectId)) {
					throw new ProcessorError("configuration_incomplete");
				}
				if (personalApiKey && projectId && request.clerkUserId) {
					await deletePostHogPerson(
						request.clerkUserId,
						personalApiKey,
						projectId,
						host,
					);
				}
				advanced = await ctx.runMutation(
					internal.accountDeletion.advanceRequestStage,
					{
						requestId: args.requestId,
						expectedStage: stage,
						nextStage: "deleteData",
						processor: "postHog",
						processorStatus: personalApiKey ? "completed" : "notConfigured",
					},
				);
			} else if (stage === "deleteData") {
				const result = await ctx.runMutation(
					internal.accountDeletion.deleteOwnerDataBatch,
					args,
				);
				if (result.done) {
					const advanced = await ctx.runMutation(
						internal.accountDeletion.advanceRequestStage,
						{
							requestId: args.requestId,
							expectedStage: stage,
							nextStage: "deleteNotion",
						},
					);
					if (advanced) {
						await ctx.scheduler.runAfter(
							0,
							internal.accountDeletionActions.processDeletionRequest,
							args,
						);
					}
				} else {
					await ctx.scheduler.runAfter(
						0,
						internal.accountDeletionActions.processDeletionRequest,
						args,
					);
					return null;
				}
			} else if (stage === "deleteNotion") {
				const result = await ctx.runAction(
					internal.crmAccountDeletion.reconcile,
					args,
				);
				if (result === "busy") {
					await ctx.scheduler.runAfter(
						60_000,
						internal.accountDeletionActions.processDeletionRequest,
						args,
					);
					return null;
				}
				if (
					!(await ctx.runMutation(
						internal.accountDeletion.completeRequest,
						args,
					))
				)
					throw new ProcessorError("completion_unverified");
			}
			if (stage !== "deleteData" && stage !== "deleteNotion" && advanced) {
				await ctx.scheduler.runAfter(
					0,
					internal.accountDeletionActions.processDeletionRequest,
					args,
				);
			}
		} catch (error) {
			const nextAttempt = request.attemptCount + 1;
			const shouldRetry = nextAttempt < MAX_RETRY_ATTEMPTS;
			const delay =
				RETRY_DELAYS_MS[Math.min(nextAttempt - 1, RETRY_DELAYS_MS.length - 1)];
			const retry = await ctx.runMutation(
				internal.accountDeletion.markRequestRetry,
				{
					requestId: args.requestId,
					expectedStage: stage,
					errorCode: errorCodeFor(stage, error),
					nextAttemptAt: Date.now() + delay,
					shouldRetry,
				},
			);
			console.error("Account deletion processor failed", {
				requestId: args.requestId,
				stage,
				errorCode: errorCodeFor(stage, error),
				attemptCount: retry.attemptCount,
			});
			if (retry.applied && shouldRetry) {
				await ctx.scheduler.runAfter(
					delay,
					internal.accountDeletionActions.processDeletionRequest,
					args,
				);
			}
		}
		return null;
	},
});
