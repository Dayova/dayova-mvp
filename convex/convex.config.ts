import agent from "@convex-dev/agent/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import convexFilesControl from "@gilhrpenner/convex-files-control/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
	env: {
		GOOGLE_VERTEX_API_KEY: v.optional(v.string()),
		GOOGLE_VERTEX_PROJECT: v.optional(v.string()),
		GOOGLE_VERTEX_LOCATION: v.optional(v.string()),
		GOOGLE_VERTEX_FLASH_MODEL: v.optional(v.string()),
		GOOGLE_VERTEX_TTS_MODEL: v.optional(v.string()),
		CLERK_SECRET_KEY: v.optional(v.string()),
		POSTHOG_API_HOST: v.optional(v.string()),
		POSTHOG_PERSONAL_API_KEY: v.optional(v.string()),
		POSTHOG_PROJECT_ID: v.optional(v.string()),
		DAYOVA_DEPLOYMENT_ENVIRONMENT: v.optional(v.string()),
		REVENUECAT_SECRET_API_KEY: v.optional(v.string()),
		REVENUECAT_WEBHOOK_AUTHORIZATION: v.optional(v.string()),
	},
});

app.use(convexFilesControl);
app.use(agent);
app.use(workflow);

export default app;
