import {
	isOnboardingPath,
	ONBOARDING_PATH,
	PASSWORD_RESET_SUCCESS_PATH,
	SESSION_TASK_RESET_PASSWORD_PATH,
} from "~/lib/auth-routing";

export const OFFLINE_ACCESS_WINDOW_MS = 72 * 60 * 60 * 1000;

export type AccessState =
	| "needsActivation"
	| "trial"
	| "paid"
	| "billingGrace"
	| "expired";

type AccessMetadata = {
	trialStartedAt?: number;
	trialExpiresAt?: number;
	reminderAt?: number;
	trialTermsVersion?: string;
	subscriptionExpiresAt?: number;
	subscriptionGraceExpiresAt?: number;
	managementUrl?: string;
	productId?: string;
	store?: string;
	willRenew?: boolean;
};

export type AccessSnapshot =
	| ({
			canUseApp: false;
			state: "needsActivation";
	  } & AccessMetadata)
	| ({
			canUseApp: true;
			state: "trial";
			trialExpiresAt: number;
	  } & AccessMetadata)
	| ({
			canUseApp: false;
			state: "expired";
			trialExpiresAt?: number;
	  } & AccessMetadata)
	| ({
			canUseApp: true;
			state: "paid";
	  } & AccessMetadata)
	| ({
			canUseApp: true;
			state: "billingGrace";
			subscriptionGraceExpiresAt: number;
	  } & AccessMetadata);

const PUBLIC_AUTH_PATHS = new Set([
	"/",
	"/login",
	"/register",
	ONBOARDING_PATH,
]);
const ACCESS_SETUP_PATHS = new Set(["/trial", "/paywall", "/subscription"]);
const EXPIRED_ACCESS_PATHS = new Set(["/paywall", "/subscription"]);
const ACCESS_BYPASS_PATHS = new Set([
	ONBOARDING_PATH,
	PASSWORD_RESET_SUCCESS_PATH,
	SESSION_TASK_RESET_PASSWORD_PATH,
]);
const PRO_WELCOME_PATH = "/pro-welcome";

export const resolveAccessRoute = ({
	accessState,
	isSessionLoading,
	pathname,
	user,
}: {
	accessState: AccessState | undefined;
	isSessionLoading: boolean;
	pathname: string;
	user: { id: string } | null | undefined;
}) => {
	if (isSessionLoading) return null;

	const isAuthRoute =
		PUBLIC_AUTH_PATHS.has(pathname) || isOnboardingPath(pathname);
	if (!user) return isAuthRoute ? null : "/";
	if (ACCESS_BYPASS_PATHS.has(pathname) || isOnboardingPath(pathname))
		return null;
	if (!accessState) return null;

	if (accessState === "needsActivation") {
		return pathname === "/trial" ? null : "/trial";
	}
	if (accessState === "expired") {
		return EXPIRED_ACCESS_PATHS.has(pathname) ? null : "/paywall";
	}
	if (pathname === PRO_WELCOME_PATH) {
		return accessState === "paid" ? null : "/home";
	}
	if (accessState === "trial" && pathname === "/subscription") {
		return null;
	}
	if (isAuthRoute || ACCESS_SETUP_PATHS.has(pathname)) {
		return "/home";
	}

	return null;
};

export const getOfflineAccess = ({
	access,
	now,
	verifiedAt,
}: {
	access: AccessSnapshot;
	now: number;
	verifiedAt: number;
}) => {
	if (!access.canUseApp) return false;
	if (now > verifiedAt + OFFLINE_ACCESS_WINDOW_MS) return false;

	if (access.state === "trial") {
		return now < access.trialExpiresAt;
	}

	const paidDates = [
		access.subscriptionExpiresAt,
		access.subscriptionGraceExpiresAt,
	].filter((value): value is number => value !== undefined);
	const paidThrough =
		paidDates.length > 0 ? Math.max(...paidDates) : Number.POSITIVE_INFINITY;
	return now < paidThrough;
};

export const getNextAccessRefreshAt = (access: AccessSnapshot | undefined) => {
	if (!access?.canUseApp) return null;
	if (access.state === "trial") return access.trialExpiresAt;

	const paidDates = [
		access.subscriptionExpiresAt,
		access.subscriptionGraceExpiresAt,
	].filter((value): value is number => value !== undefined);
	return paidDates.length > 0 ? Math.max(...paidDates) : null;
};
