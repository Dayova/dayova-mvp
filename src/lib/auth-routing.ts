export const SESSION_TASK_RESET_PASSWORD_PATH = "/session-tasks/reset-password";
export const PASSWORD_RESET_SUCCESS_PATH = "/password-reset-success";

const PUBLIC_AUTH_PATHS = new Set(["/", "/login", "/register", "/onboarding"]);

type AuthNavigationState = {
	hasUser: boolean;
	isSessionLoading: boolean;
	pathname: string;
	pendingSessionTask: string | null;
};

export const getAuthNavigationTarget = ({
	hasUser,
	isSessionLoading,
	pathname,
	pendingSessionTask,
}: AuthNavigationState) => {
	if (isSessionLoading) return null;

	if (pendingSessionTask === "reset-password") {
		return pathname === SESSION_TASK_RESET_PASSWORD_PATH
			? null
			: SESSION_TASK_RESET_PASSWORD_PATH;
	}

	if (pathname === SESSION_TASK_RESET_PASSWORD_PATH) {
		return hasUser ? "/home" : "/";
	}

	const isPublicAuthPath = PUBLIC_AUTH_PATHS.has(pathname);
	if (!hasUser && !isPublicAuthPath) return "/";
	if (hasUser && isPublicAuthPath && pathname !== "/onboarding") return "/home";

	return null;
};
