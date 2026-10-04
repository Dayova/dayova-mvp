import agent from "@convex-dev/agent/convex.config";
import migrations from "@convex-dev/migrations/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import convexFilesControl from "@gilhrpenner/convex-files-control/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
	env: {
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
app.use(agent);
app.use(workflow);
app.use(migrations);

export default app;
