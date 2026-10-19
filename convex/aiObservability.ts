"use node";

import { withAiOperation } from "../ai/observability";
import type { ActionCtx } from "./_generated/server";

export const traceAiAction = async <T>(
	ctx: ActionCtx,
	operation: string,
	entityId: string,
	task: () => Promise<T>,
): Promise<T> => {
	if (process.env.LANGFUSE_ENABLED !== "true") return await task();
	let actorId: string | undefined;
	try {
		actorId = (await ctx.auth.getUserIdentity())?.tokenIdentifier;
	} catch {
		/* Telemetry must not introduce an auth failure. */
	}
	return await withAiOperation({ operation, entityId, actorId }, task);
};
