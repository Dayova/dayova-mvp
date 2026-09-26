import convexFilesControl from "@gilhrpenner/convex-files-control/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
	env: {
		CLERK_SECRET_KEY: v.optional(v.string()),
		POSTHOG_API_HOST: v.optional(v.string()),
		POSTHOG_PERSONAL_API_KEY: v.optional(v.string()),
		POSTHOG_PROJECT_ID: v.optional(v.string()),
		DAYOVA_DEPLOYMENT_ENVIRONMENT: v.optional(v.string()),
		NOTION_CRM_TOKEN: v.optional(v.string()),
		NOTION_CRM_DATA_SOURCE_ID: v.optional(v.string()),
		NOTION_CRM_MODE: v.optional(
			v.union(v.literal("off"), v.literal("dry-run"), v.literal("live")),
		),
		REVENUECAT_SECRET_API_KEY: v.optional(v.string()),
		REVENUECAT_WEBHOOK_AUTHORIZATION: v.optional(v.string()),
	},
});

app.use(convexFilesControl);

export default app;
