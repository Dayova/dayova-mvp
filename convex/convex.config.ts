import migrations from "@convex-dev/migrations/convex.config";
import convexFilesControl from "@gilhrpenner/convex-files-control/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
	env: {
		LANGFUSE_ENABLED: v.optional(v.string()),
		LANGFUSE_PUBLIC_KEY: v.optional(v.string()),
		LANGFUSE_SECRET_KEY: v.optional(v.string()),
		LANGFUSE_BASE_URL: v.optional(v.string()),
		LANGFUSE_TRACING_ENVIRONMENT: v.optional(v.string()),
		LANGFUSE_RELEASE: v.optional(v.string()),
		LANGFUSE_USER_HASH_SECRET: v.optional(v.string()),
		CLERK_SECRET_KEY: v.optional(v.string()),
		POSTHOG_API_HOST: v.optional(v.string()),
		POSTHOG_PERSONAL_API_KEY: v.optional(v.string()),
		POSTHOG_PROJECT_ID: v.optional(v.string()),
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
app.use(migrations);

export default app;
