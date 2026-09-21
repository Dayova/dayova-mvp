import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval(
	"Reconcile student CRM",
	{ hours: 1 },
	internal.crmSync.reconcile,
	{},
);
export default crons;
