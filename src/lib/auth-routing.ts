import type { PendingOnboardingSyncResumeResult } from "./pending-onboarding-sync";

export const SESSION_TASK_RESET_PASSWORD_PATH = "/session-tasks/reset-password";
export const PASSWORD_RESET_SUCCESS_PATH = "/password-reset-success";
export const ONBOARDING_PATH = "/onboarding";
export const ONBOARDING_CREATION_PATH = `${ONBOARDING_PATH}/creating`;

export const isOnboardingPath = (pathname: string) =>
	pathname === ONBOARDING_PATH || pathname.startsWith(`${ONBOARDING_PATH}/`);

export type OnboardingCompletionStatus =
	| PendingOnboardingSyncResumeResult["status"]
	| "loading"
	| "storage_error";

export const isOnboardingSettled = (status: OnboardingCompletionStatus) =>
	status === "none" || status === "ready_for_trial";

const PUBLIC_AUTH_PATHS = new Set([
	"/",
	"/login",
	"/register",
	ONBOARDING_PATH,
	PASSWORD_RESET_SUCCESS_PATH,
]);

const isPublicAuthPath = (pathname: string) =>
	PUBLIC_AUTH_PATHS.has(pathname) || isOnboardingPath(pathname);

const SIGNED_IN_REDIRECT_PATHS = new Set(["/", "/login", "/register"]);

type AuthNavigationState = {
	hasUser: boolean;
	isSessionLoading: boolean;
	onboardingCompletionStatus?: OnboardingCompletionStatus;
	pathname: string;
	pendingSessionTask: string | null;
};

export const getAuthNavigationTarget = ({
	hasUser,
	isSessionLoading,
	onboardingCompletionStatus = "none",
	pathname,
	pendingSessionTask,
}: AuthNavigationState) => {
	if (isSessionLoading || onboardingCompletionStatus === "loading") return null;

	if (pendingSessionTask === "reset-password") {
		return pathname === SESSION_TASK_RESET_PASSWORD_PATH
			? null
			: SESSION_TASK_RESET_PASSWORD_PATH;
	}

	if (pathname === SESSION_TASK_RESET_PASSWORD_PATH) {
		return hasUser ? "/home" : "/";
	}
	if (hasUser && onboardingCompletionStatus !== "none") {
		return pathname === ONBOARDING_CREATION_PATH
			? null
			: ONBOARDING_CREATION_PATH;
	}

	if (!hasUser && !isPublicAuthPath(pathname)) return "/";
	if (hasUser && SIGNED_IN_REDIRECT_PATHS.has(pathname)) return "/home";

	return null;
};
