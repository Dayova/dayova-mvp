import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { getBerlinDayKey } from "./dayKeyVariants";

const migrations = new Migrations<DataModel>(components.migrations);

/** Resumable backfill. Preserve raw dates and mark invalid legacy dates as null. */
export const backfillBerlinDayKeys = migrations.define({
	table: "learningPlanSessions",
	batchSize: 100,
	migrateOne: async (ctx, session) => {
		const berlinDayKey = getBerlinDayKey(session.dateKey);
		if (session.berlinDayKey !== berlinDayKey) {
			await ctx.db.patch("learningPlanSessions", session._id, { berlinDayKey });
		}
	},
});
