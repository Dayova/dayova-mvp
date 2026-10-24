import type { Doc } from "./_generated/dataModel";

export const getPaidThrough = (entitlement: {
	subscriptionExpiresAt?: number;
	subscriptionGraceExpiresAt?: number;
}) => {
	const accessDates = [
		entitlement.subscriptionExpiresAt,
		entitlement.subscriptionGraceExpiresAt,
	].filter((value): value is number => value !== undefined);
	return accessDates.length > 0
		? Math.max(...accessDates)
		: Number.POSITIVE_INFINITY;
};

export const toTrialAccess = (entitlement: {
	trialStartedAt: number;
	trialExpiresAt: number;
	trialReminderAt: number;
	trialTermsVersion: string;
}) => ({
	canUseApp: true as const,
	state: "trial" as const,
	trialStartedAt: entitlement.trialStartedAt,
	trialExpiresAt: entitlement.trialExpiresAt,
	reminderAt: entitlement.trialReminderAt,
	trialTermsVersion: entitlement.trialTermsVersion,
});

const toPaidAccess = (entitlement: {
	subscriptionBillingIssueDetectedAt?: number;
	subscriptionExpiresAt?: number;
	subscriptionGraceExpiresAt?: number;
	subscriptionManagementUrl?: string;
	subscriptionProductId?: string;
	subscriptionStore?: string;
	subscriptionWillRenew?: boolean;
}) => {
	const metadata = {
		canUseApp: true as const,
		managementUrl: entitlement.subscriptionManagementUrl,
		productId: entitlement.subscriptionProductId,
		store: entitlement.subscriptionStore,
		subscriptionExpiresAt: entitlement.subscriptionExpiresAt,
		subscriptionGraceExpiresAt: entitlement.subscriptionGraceExpiresAt,
		willRenew: entitlement.subscriptionWillRenew ?? false,
	};
	if (
		entitlement.subscriptionBillingIssueDetectedAt &&
		entitlement.subscriptionGraceExpiresAt !== undefined
	) {
		return {
			...metadata,
			state: "billingGrace" as const,
			subscriptionGraceExpiresAt: entitlement.subscriptionGraceExpiresAt,
		};
	}
	return { ...metadata, state: "paid" as const };
};

export const getCurrentAccess = (
	entitlement: Doc<"accessEntitlements">,
	now: number,
) => {
	if (
		entitlement.revenueCatEntitlementActive &&
		now < getPaidThrough(entitlement)
	) {
		return toPaidAccess(entitlement);
	}

	if (
		entitlement.trialStartedAt === undefined ||
		entitlement.trialExpiresAt === undefined ||
		entitlement.trialReminderAt === undefined ||
		entitlement.trialTermsVersion === undefined
	) {
		return {
			canUseApp: false as const,
			managementUrl: entitlement.subscriptionManagementUrl,
			productId: entitlement.subscriptionProductId,
			state: "expired" as const,
			store: entitlement.subscriptionStore,
			subscriptionExpiresAt: entitlement.subscriptionExpiresAt,
			subscriptionGraceExpiresAt: entitlement.subscriptionGraceExpiresAt,
			willRenew: entitlement.subscriptionWillRenew ?? false,
		};
	}

	const trialAccess = toTrialAccess({
		trialStartedAt: entitlement.trialStartedAt,
		trialExpiresAt: entitlement.trialExpiresAt,
		trialReminderAt: entitlement.trialReminderAt,
		trialTermsVersion: entitlement.trialTermsVersion,
	});

	if (now >= entitlement.trialExpiresAt) {
		return {
			...trialAccess,
			canUseApp: false as const,
			managementUrl: entitlement.subscriptionManagementUrl,
			productId: entitlement.subscriptionProductId,
			state: "expired" as const,
			store: entitlement.subscriptionStore,
			subscriptionExpiresAt: entitlement.subscriptionExpiresAt,
			subscriptionGraceExpiresAt: entitlement.subscriptionGraceExpiresAt,
			willRenew: entitlement.subscriptionWillRenew ?? false,
		};
	}

	return trialAccess;
};
