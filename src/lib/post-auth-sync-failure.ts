export type PostAuthSyncFailure =
	| "profile"
	| "answers"
	| "completion"
	| "restore";

export const getOnboardingRecoveryOwnedBoundary = (
	hasVerificationRecovery: boolean,
): PostAuthSyncFailure => (hasVerificationRecovery ? "restore" : "answers");

export const clearOwnedPostAuthSyncFailure = (
	current: PostAuthSyncFailure | null,
	owner: PostAuthSyncFailure,
) => (current === owner ? null : current);

export const retryPostAuthSyncFailure = (
	failure: PostAuthSyncFailure | null,
	handlers: Record<PostAuthSyncFailure, () => void>,
) => {
	if (failure) handlers[failure]();
};
