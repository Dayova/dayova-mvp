import { customAction, customCtx } from "convex-helpers/server/customFunctions";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
export const learningAction = customAction(
	action,
	customCtx(async (ctx) => {
		await ctx.runMutation(internal.accessState.assertMyLearningAccess, {});
		return {};
	}),
);
