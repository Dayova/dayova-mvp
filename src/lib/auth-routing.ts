export const SESSION_TASK_RESET_PASSWORD_PATH = "/session-tasks/reset-password";
export const PASSWORD_RESET_SUCCESS_PATH = "/password-reset-success";

const PUBLIC_AUTH_PATHS = new Set([
	"/",
	"/login",
	"/register",
	"/onboarding",
	PASSWORD_RESET_SUCCESS_PATH,
]);

const SIGNED_IN_REDIRECT_PATHS = new Set(["/", "/login", "/register"]);

type AuthNavigationState = {
	hasUser: boolean;
	isSessionLoading: boolean;
	onboardingCompletionStatus?:
		| "loading"
		| "none"
		| "pending"
		| "ready_for_trial"
		| "recovery_required"
		| "storage_error";
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
		return pathname === "/onboarding" ? null : "/onboarding";
	}

	const isPublicAuthPath = PUBLIC_AUTH_PATHS.has(pathname);
	if (!hasUser && !isPublicAuthPath) return "/";
	if (hasUser && SIGNED_IN_REDIRECT_PATHS.has(pathname)) return "/home";

	return null;
};
