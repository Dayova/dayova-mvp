export const OFFLINE_ACCESS_WINDOW_MS = 72 * 60 * 60 * 1000;

export type AccessState =
	| "needsActivation"
	| "trial"
	| "paid"
	| "billingGrace"
	| "expired";

type AccessSnapshot =
	| {
			canUseApp: false;
			state: "needsActivation";
	  }
	| {
			canUseApp: true;
			state: "trial";
			trialExpiresAt: number;
	  }
	| {
			canUseApp: false;
			state: "expired";
			trialExpiresAt: number;
	  }
	| {
			canUseApp: true;
			state: "paid" | "billingGrace";
			subscriptionExpiresAt?: number;
			subscriptionGraceExpiresAt?: number;
	  };

const PUBLIC_AUTH_PATHS = new Set(["/", "/login", "/register", "/onboarding"]);
const ACCESS_SETUP_PATHS = new Set(["/trial", "/paywall"]);

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

	const isAuthRoute = PUBLIC_AUTH_PATHS.has(pathname);
	if (!user) return isAuthRoute ? null : "/";
	if (pathname === "/onboarding") return null;
	if (!accessState) return null;

	if (accessState === "needsActivation") {
		return pathname === "/trial" ? null : "/trial";
	}
	if (accessState === "expired") {
		return pathname === "/paywall" ? null : "/paywall";
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

	const paidThrough =
		access.subscriptionGraceExpiresAt ??
		access.subscriptionExpiresAt ??
		Number.POSITIVE_INFINITY;
	return now < paidThrough;
};
