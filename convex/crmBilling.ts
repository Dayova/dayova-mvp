import type { Doc } from "./_generated/dataModel";
import type { CrmProjection } from "./crmContract";

// Verified against the Dayova RevenueCat catalog on 2026-09-21. Store IDs are
// contracts: the spelling of the iOS annual identifier is intentional.
const plans = new Map<string, "Monthly" | "Annual">([
	["app_store:com.dayova.abonnement.monthly", "Monthly"],
	["app_store:com.dayova.abonnemment.yearly", "Annual"],
	["play_store:dayova_monthly:monthly-autorenewing", "Monthly"],
	["play_store:dayova_annual:annual-autorenewing", "Annual"],
	// Dedicated Android subscription IDs also identify these billing cadences.
	["play_store:dayova_monthly", "Monthly"],
	["play_store:dayova_annual", "Annual"],
]);

export function crmBilling(
	entitlement: Doc<"accessEntitlements"> | undefined,
	state: CrmProjection["state"],
): Pick<CrmProjection, "paymentStatus" | "subscriptionPlan"> {
	const hasSubscription = state === "paid" || state === "billing grace";
	if (!hasSubscription) {
		return {
			paymentStatus:
				state === "trial" ? "Trial" : state === "expired" ? "Expired" : "None",
			subscriptionPlan: "None",
		};
	}
	if (entitlement?.subscriptionVerifiedAt === undefined) {
		return { paymentStatus: "Unknown", subscriptionPlan: "Unknown" };
	}
	return {
		paymentStatus:
			entitlement.subscriptionBillingIssueDetectedAt !== undefined
				? "Overdue"
				: entitlement.subscriptionPeriodType === "trial"
					? "Trial"
					: entitlement.subscriptionPeriodType === "normal" ||
							entitlement.subscriptionPeriodType === "intro"
						? "Paid"
						: "Unknown",
		subscriptionPlan:
			plans.get(
				`${entitlement.subscriptionStore}:${entitlement.subscriptionProductId}`,
			) ?? "Unknown",
	};
}
