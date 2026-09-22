import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval(
	"Deliver Loops student contacts",
	{ minutes: 5 },
	internal.loopsSync.reconcile,
	{},
);
crons.interval(
	"Reconcile student CRM",
	{ hours: 1 },
	internal.crmSync.reconcile,
	{},
);
export default crons;
