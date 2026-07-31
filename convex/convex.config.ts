import convexFilesControl from "@gilhrpenner/convex-files-control/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
	env: {
		REVENUECAT_SECRET_API_KEY: v.optional(v.string()),
		REVENUECAT_WEBHOOK_AUTHORIZATION: v.optional(v.string()),
		LEARNING_PLAN_AI_MONTHLY_HARD_USD_MICROS: v.optional(v.string()),
		LEARNING_PLAN_AI_MONTHLY_ECONOMY_USD_MICROS: v.optional(v.string()),
		LEARNING_PLAN_AI_MONTHLY_SPECULATION_USD_MICROS: v.optional(v.string()),
		LEARNING_PLAN_AI_PLAN_TARGET_USD_MICROS: v.optional(v.string()),
		LEARNING_PLAN_AI_PLAN_HARD_USD_MICROS: v.optional(v.string()),
	},
});

app.use(convexFilesControl);

export default app;
