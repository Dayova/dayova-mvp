import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { refreshOwnerAccess } from "./accessState";

const migrations = new Migrations<DataModel>(components.migrations);
/** Initializes derived state and schedules only. Stored cohort deadlines are preserved. */
export const initializeAccessProjection = migrations.define({
	table: "accessEntitlements",
	batchSize: 100,
	migrateOne: async (ctx, row) => {
		await refreshOwnerAccess(ctx, row.ownerTokenIdentifier);
	},
});
