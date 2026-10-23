import {
	customCtx,
	customMutation,
	customQuery,
} from "convex-helpers/server/customFunctions";
import { mutation, query } from "./_generated/server";
import { assertLearningAccess } from "./accessState";
import { throwUserFacingError } from "./errors";
export const learningQuery = customQuery(
	query,
	customCtx(async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		await assertLearningAccess(ctx, identity.tokenIdentifier);
		return {};
	}),
);
export const learningMutation = customMutation(
	mutation,
	customCtx(async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throwUserFacingError("Nicht authentifiziert.");
		await assertLearningAccess(ctx, identity.tokenIdentifier, Date.now());
		return {};
	}),
);
export { learningAction } from "./learningActions";
