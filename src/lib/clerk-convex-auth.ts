import { useAuth, useUser } from "@clerk/expo";
import { useCallback, useMemo, useRef } from "react";

// ConvexProviderWithClerk refreshes its token callback for organization changes,
// but not when a user selects a new primary email address. Include that address
// so Convex reauthenticates with a fresh Clerk token after verification.
export function useClerkConvexAuth() {
	const { isLoaded, isSignedIn, getToken, orgId, orgRole, sessionId } =
		useAuth();
	const { user } = useUser();
	const primaryEmail = user?.primaryEmailAddress?.emailAddress;
	const contextKey = JSON.stringify([sessionId, orgId, orgRole, primaryEmail]);
	const lastFreshContext = useRef<string | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Clerk's getToken is not memoized; identity changes must drive Convex reauthentication.
	const fetchAccessToken = useCallback(
		async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
			const mustRefresh =
				forceRefreshToken || lastFreshContext.current !== contextKey;
			try {
				// A Clerk session can have aud="convex" without an email claim.
				// The JWT template includes the verified primary email needed by syncCurrentUser.
				const token = await getToken({
					template: "convex",
					skipCache: mustRefresh,
				});
				if (token) {
					if (mustRefresh) lastFreshContext.current = contextKey;
					return token;
				}
			} catch {
				// A token from an old email or session must not be used as a fallback.
			}
			return null;
		},
		// Clerk's Expo getToken is not memoized; session and primary-email changes
		// should restart Convex authentication.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[contextKey],
	);

	return useMemo(
		() => ({
			isLoading: !isLoaded,
			isAuthenticated: isSignedIn ?? false,
			fetchAccessToken,
		}),
		[isLoaded, isSignedIn, fetchAccessToken],
	);
}
