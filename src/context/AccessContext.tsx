import {
	useAction,
	useConvexAuth,
	useConvexConnectionState,
	useMutation,
	useQuery,
} from "convex/react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { AppState } from "react-native";
import { api } from "#convex/_generated/api";
import { useAuthSession, useOnboardingHandoff } from "~/context/AuthContext";
import {
	type AccessSnapshot,
	getNextAccessRefreshAt,
	getOfflineAccess,
	OFFLINE_ACCESS_WINDOW_MS,
} from "~/lib/access-policy";
import { isOnboardingSettled } from "~/lib/auth-routing";

type AccessContextValue = {
	access: AccessSnapshot | undefined;
	activateTrial: (termsVersion: string) => Promise<void>;
	isAccessLoading: boolean;
	isVerificationRequired: boolean;
	retryAccessVerification: () => Promise<void>;
	refreshPaidAccess: () => Promise<boolean>;
};
type Verification = {
	appUserId: string;
	access: AccessSnapshot;
	serverNow: number;
	monotonicAt: number;
};
const AccessContext = createContext<AccessContextValue | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
	const {
		user,
		isSessionLoading,
		isConvexUserSynced,
		isPostAuthSyncing,
		onboardingCompletionStatus,
	} = useAuthSession();
	const { retryPostAuthSync } = useOnboardingHandoff();
	const appUserId = user?.clerkId ?? null;
	const canWaitForVerification = Boolean(appUserId && !isSessionLoading);
	const { isAuthenticated } = useConvexAuth();
	const { isWebSocketConnected } = useConvexConnectionState();
	const canQuery = Boolean(
		appUserId &&
			isAuthenticated &&
			isConvexUserSynced &&
			isOnboardingSettled(onboardingCompletionStatus),
	);
	const activateMyTrial = useMutation(api.entitlements.activateMyTrial);
	const verifyAccess = useMutation(api.accessState.refreshMyAccess);
	const syncMyEntitlement = useAction(api.revenueCat.syncMyEntitlement);
	// Reactive changes trigger a fresh clock verification. Cached queries can never start an offline lease.
	const serverAccess = useQuery(
		api.entitlements.getMyAccess,
		canQuery ? {} : "skip",
	);
	const [verification, setVerification] = useState<Verification | null>(null);
	const [timedOut, setTimedOut] = useState<{
		appUserId: string;
		epoch: number;
	} | null>(null);
	const [monotonicNow, setMonotonicNow] = useState(() => performance.now());
	const [accountScope, setAccountScope] = useState(appUserId);
	const [observedQuery, setObservedQuery] = useState(serverAccess);
	const identity = useRef(appUserId);
	const generation = useRef(0);
	const foreground = useRef(
		AppState.currentState === "active" || AppState.currentState === "inactive",
	);
	const pending = useRef<{ appUserId: string; request: Promise<void> } | null>(
		null,
	);
	const [verificationEpoch, setVerificationEpoch] = useState(0);
	if (accountScope !== appUserId) {
		setAccountScope(appUserId);
		setVerification(null);
		setTimedOut(null);
	}
	if (observedQuery !== serverAccess) {
		setObservedQuery(serverAccess);
		if (
			canQuery &&
			serverAccess &&
			!serverAccess.canUseApp &&
			verification?.appUserId === appUserId
		) {
			setVerification({
				...verification,
				access: serverAccess,
			});
		}
	}
	const invalidateRequests = useCallback(() => {
		generation.current++;
		pending.current = null;
	}, []);
	useEffect(() => {
		identity.current = appUserId;
		invalidateRequests();
		return invalidateRequests;
	}, [appUserId, invalidateRequests]);
	const refresh = useCallback(async () => {
		if (!canQuery || !appUserId || !foreground.current || !isWebSocketConnected)
			return;
		if (pending.current?.appUserId === appUserId)
			return pending.current.request;
		const requestGeneration = ++generation.current;
		// Start before the request: round-trip latency shortens, never extends, the lease.
		const monotonicAt = performance.now();
		const request = verifyAccess({})
			.then((result) => {
				if (
					foreground.current &&
					identity.current === appUserId &&
					generation.current === requestGeneration
				) {
					setMonotonicNow(performance.now());
					setVerification({
						appUserId,
						access: result.access,
						serverNow: result.serverNow,
						monotonicAt,
					});
				}
			})
			.finally(() => {
				if (pending.current?.request === request) pending.current = null;
			});
		pending.current = { appUserId, request };
		return request;
	}, [appUserId, canQuery, isWebSocketConnected, verifyAccess]);

	useEffect(() => {
		if (!canQuery) return;
		if (serverAccess && !serverAccess.canUseApp) {
			invalidateRequests();
		}
		void refresh().catch(() => {
			/* A failed request cannot grant or renew access. */
		});
	}, [canQuery, invalidateRequests, refresh, serverAccess]);
	useEffect(() => {
		if (!appUserId || !canWaitForVerification) return;
		const timer = setTimeout(
			() => setTimedOut({ appUserId, epoch: verificationEpoch }),
			1500,
		);
		return () => clearTimeout(timer);
	}, [appUserId, canWaitForVerification, verificationEpoch]);
	useEffect(() => {
		if (!canQuery) return;
		// Retry offline failures and renew the lease only when a real server response arrives.
		const interval = setInterval(() => {
			setMonotonicNow(performance.now());
			void refresh().catch(() => {});
		}, 30_000);
		return () => clearInterval(interval);
	}, [canQuery, refresh]);
	useEffect(() => {
		const listener = AppState.addEventListener("change", (state) => {
			if (state === "background") {
				foreground.current = false;
				// JS monotonic clocks may pause in device sleep. A background transition ends this lease.
				invalidateRequests();
				setVerification(null);
				setTimedOut(null);
			} else if (state === "active" && !foreground.current) {
				foreground.current = true;
				setVerificationEpoch((value) => value + 1);
				setMonotonicNow(performance.now());
				void refresh().catch(() => {});
			}
		});
		return () => listener.remove();
	}, [invalidateRequests, refresh]);
	const current = verification?.appUserId === appUserId ? verification : null;
	// Never read Date.now() or a persisted access cache to authorize this process.
	const elapsed = current ? monotonicNow - current.monotonicAt : 0;
	const trustedNow = current ? current.serverNow + elapsed : 0;
	const entitlementExpiresAt = getNextAccessRefreshAt(current?.access);
	const knownExpired =
		entitlementExpiresAt !== null && trustedNow >= entitlementExpiresAt;
	const verifiedAccess =
		current && elapsed >= 0 && Number.isFinite(elapsed)
			? !current.access.canUseApp
				? current.access
				: knownExpired
					? {
							...current.access,
							state: "expired" as const,
							canUseApp: false as const,
						}
					: getOfflineAccess({
								access: current.access,
								verifiedAt: current.serverNow,
								now: trustedNow,
							})
						? current.access
						: undefined
			: undefined;
	const access = canQuery ? verifiedAccess : undefined;
	const isVerificationRequired =
		canWaitForVerification &&
		!verifiedAccess &&
		timedOut?.appUserId === appUserId &&
		timedOut?.epoch === verificationEpoch;
	useEffect(() => {
		if (!current?.access.canUseApp) return;
		const expiry = getNextAccessRefreshAt(current.access);
		const remaining =
			Math.min(
				expiry ?? Infinity,
				current.serverNow + OFFLINE_ACCESS_WINDOW_MS,
			) - trustedNow;
		if (remaining <= 0) return;
		const timer = setTimeout(
			() => {
				setMonotonicNow(performance.now());
				void refresh().catch(() => {});
			},
			Math.min(remaining, 2_147_000_000),
		);
		return () => clearTimeout(timer);
	}, [current, trustedNow, refresh]);
	const activateTrial = useCallback(
		async (termsVersion: string) => {
			await activateMyTrial({ termsVersion });
			await pending.current?.request.catch(() => {});
			await refresh();
		},
		[activateMyTrial, refresh],
	);
	const refreshPaidAccess = useCallback(async () => {
		const result = await syncMyEntitlement({});
		await pending.current?.request.catch(() => {});
		await refresh();
		return result.active;
	}, [refresh, syncMyEntitlement]);
	const retryAccessVerification = useCallback(async () => {
		if (!isWebSocketConnected)
			throw new Error("Online-Verbindung erforderlich");
		if (!canQuery) {
			if (!isPostAuthSyncing) retryPostAuthSync();
			throw new Error("Anmeldung oder Profilabgleich noch nicht bestätigt");
		}
		await refresh();
	}, [
		canQuery,
		isPostAuthSyncing,
		isWebSocketConnected,
		refresh,
		retryPostAuthSync,
	]);
	const isAccessLoading =
		Boolean(user) &&
		!isSessionLoading &&
		isOnboardingSettled(onboardingCompletionStatus) &&
		!access;
	const value = useMemo(
		() => ({
			access,
			activateTrial,
			isAccessLoading,
			isVerificationRequired,
			retryAccessVerification,
			refreshPaidAccess,
		}),
		[
			access,
			activateTrial,
			isAccessLoading,
			isVerificationRequired,
			retryAccessVerification,
			refreshPaidAccess,
		],
	);
	return (
		<AccessContext.Provider value={value}>{children}</AccessContext.Provider>
	);
}
export function useAccess() {
	const value = useContext(AccessContext);
	if (!value) throw new Error("useAccess must be used within AccessProvider");
	return value;
}
