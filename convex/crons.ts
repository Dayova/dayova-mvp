import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval(
	"Expire completed account-deletion replay barriers",
	{ hours: 1 },
	internal.clerkLifecycle.purgeExpiredDeletionBarriers,
	{},
);
crons.interval(
	"Expire completed account-deletion audits",
	{ hours: 1 },
	internal.accountDeletion.purgeCompletedAudits,
	{},
);
crons.interval(
	"Reconcile student CRM",
	{ hours: 1 },
	internal.crmSync.reconcile,
	{},
);
crons.interval(
	"Deliver student CRM updates",
	{ minutes: 5 },
	internal.crmSync.reconcile,
	{ updatesOnly: true },
);
export default crons;
