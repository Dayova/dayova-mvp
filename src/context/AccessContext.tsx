import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import * as SecureStore from "expo-secure-store";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { Platform } from "react-native";
import { api } from "#convex/_generated/api";
import { useAuthSession } from "~/context/AuthContext";
import {
	type AccessSnapshot,
	getNextAccessRefreshAt,
	getOfflineAccess,
} from "~/lib/access-policy";
import { isOnboardingSettled } from "~/lib/auth-routing";
import { logDiagnosticError } from "~/lib/diagnostics";

// SecureStore keys may only contain alphanumeric characters, `.`, `-`, and `_`.
const ACCESS_CACHE_PREFIX = "dayova-access.";
const LEGACY_WEB_ACCESS_CACHE_PREFIX = "dayova-access:";
const ACCESS_QUERY_TIMEOUT_MS = 1_500;
const ACCESS_CLOCK_INTERVAL_MS = 30_000;
const MAX_TIMER_DELAY_MS = 2_147_000_000;

export type { AccessSnapshot } from "~/lib/access-policy";

type CachedAccess = {
	access: AccessSnapshot;
	verifiedAt: number;
};

type AccessContextValue = {
	access: AccessSnapshot | undefined;
	activateTrial: (termsVersion: string) => Promise<void>;
	isAccessLoading: boolean;
	refreshPaidAccess: () => Promise<boolean>;
};

const AccessContext = createContext<AccessContextValue | null>(null);

const cacheKey = (appUserId: string) => `${ACCESS_CACHE_PREFIX}${appUserId}`;

const readCachedAccess = async (appUserId: string) => {
	const key = cacheKey(appUserId);
	let serialized =
		Platform.OS === "web"
			? globalThis.localStorage?.getItem(key)
			: await SecureStore.getItemAsync(key);
	if (!serialized && Platform.OS === "web") {
		const legacyKey = `${LEGACY_WEB_ACCESS_CACHE_PREFIX}${appUserId}`;
		serialized = globalThis.localStorage?.getItem(legacyKey) ?? null;
		if (serialized) {
			try {
				globalThis.localStorage?.setItem(key, serialized);
				globalThis.localStorage?.removeItem(legacyKey);
			} catch (error) {
				logDiagnosticError("Unable to migrate cached web access.", error, {
					source: "access.cache.migrate",
					level: "warn",
				});
			}
		}
	}
	if (!serialized) return null;

	try {
		return JSON.parse(serialized) as CachedAccess;
	} catch {
		return null;
	}
};

const writeCachedAccess = async (
	appUserId: string,
	cachedAccess: CachedAccess,
) => {
	const key = cacheKey(appUserId);
	const serialized = JSON.stringify(cachedAccess);
	if (Platform.OS === "web") {
		globalThis.localStorage?.setItem(key, serialized);
		return;
	}
	await SecureStore.setItemAsync(key, serialized);
};

const getExpiredOfflineSnapshot = (
	cachedAccess: CachedAccess | null,
): AccessSnapshot => ({
	canUseApp: false,
	state: "expired",
	...(cachedAccess?.access.trialExpiresAt
		? { trialExpiresAt: cachedAccess.access.trialExpiresAt }
		: {}),
});

export function AccessProvider({ children }: { children: ReactNode }) {
	const {
		user,
		isSessionLoading,
		isConvexUserSynced,
		onboardingCompletionStatus,
	} = useAuthSession();
	const appUserId = user?.clerkId ?? null;
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const [now, setNow] = useState(Date.now);
	const [queryNow, setQueryNow] = useState(Date.now);
	const [loadedCache, setLoadedCache] = useState<{
		appUserId: string;
		value: CachedAccess | null;
	} | null>(null);
	const [timedOutAppUserId, setTimedOutAppUserId] = useState<string | null>(
		null,
	);
	const [lastVerified, setLastVerified] = useState<{
		appUserId: string | null;
		value: CachedAccess | null;
	}>({ appUserId, value: null });
	const activateMyTrial = useMutation(api.entitlements.activateMyTrial);
	const syncMyEntitlement = useAction(api.revenueCat.syncMyEntitlement);
	const canQuery = Boolean(
		user &&
			isConvexAuthenticated &&
			isConvexUserSynced &&
			isOnboardingSettled(onboardingCompletionStatus),
	);
	const serverAccess = useQuery(
		api.entitlements.getMyAccess,
		canQuery ? { now: queryNow } : "skip",
	) as AccessSnapshot | undefined;
	// Retain only results observed for this account in this mounted session.
	// Reset during render so an account change cannot expose the previous result.
	if (lastVerified.appUserId !== appUserId) {
		setLastVerified({ appUserId, value: null });
	} else if (
		canQuery &&
		serverAccess &&
		serverAccess !== lastVerified.value?.access
	) {
		setLastVerified({
			appUserId,
			value: { access: serverAccess, verifiedAt: now },
		});
	}
	const retainedAccess =
		canQuery && lastVerified.appUserId === appUserId
			? lastVerified.value
			: null;

	useEffect(() => {
		const interval = setInterval(
			() => setNow(Date.now()),
			ACCESS_CLOCK_INTERVAL_MS,
		);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		const refreshAt = getNextAccessRefreshAt(
			serverAccess ?? retainedAccess?.access,
		);
		if (refreshAt === null) return;

		let timeout: ReturnType<typeof setTimeout>;
		const scheduleRefresh = () => {
			const remaining = refreshAt - Date.now();
			if (remaining <= 0) {
				const refreshedAt = Date.now();
				setNow(refreshedAt);
				setQueryNow(refreshedAt);
				return;
			}
			timeout = setTimeout(
				scheduleRefresh,
				Math.min(remaining + 1, MAX_TIMER_DELAY_MS),
			);
		};
		scheduleRefresh();
		return () => clearTimeout(timeout);
	}, [retainedAccess, serverAccess]);

	useEffect(() => {
		if (!appUserId) return;

		let isActive = true;
		void readCachedAccess(appUserId)
			.then((value) => {
				if (isActive) {
					setLoadedCache({ appUserId, value });
				}
			})
			.catch((error: unknown) => {
				logDiagnosticError("Unable to read cached access.", error, {
					source: "access.cache.read",
					level: "warn",
				});
				if (isActive) {
					setLoadedCache({ appUserId, value: null });
				}
			});

		return () => {
			isActive = false;
		};
	}, [appUserId]);

	useEffect(() => {
		if (serverAccess || !appUserId || !canQuery) return;
		const timeout = setTimeout(
			() => setTimedOutAppUserId(appUserId),
			ACCESS_QUERY_TIMEOUT_MS,
		);
		return () => {
			clearTimeout(timeout);
			setTimedOutAppUserId((current) =>
				current === appUserId ? null : current,
			);
		};
	}, [appUserId, canQuery, serverAccess]);

	useEffect(() => {
		if (!appUserId || !canQuery || !serverAccess) return;
		const nextCachedAccess = {
			access: serverAccess,
			verifiedAt: Date.now(),
		};
		void writeCachedAccess(appUserId, nextCachedAccess).catch(
			(error: unknown) => {
				logDiagnosticError("Unable to cache verified access.", error, {
					source: "access.cache.write",
					level: "warn",
				});
			},
		);
	}, [appUserId, canQuery, serverAccess]);

	const cachedAccess =
		user && loadedCache && loadedCache.appUserId === user.clerkId
			? loadedCache.value
			: null;
	const isCacheLoaded =
		!user || (loadedCache !== null && loadedCache.appUserId === user.clerkId);
	const didQueryTimeout =
		canQuery && Boolean(user) && timedOutAppUserId === user?.clerkId;
	const offlineAccess = useMemo(() => {
		if (!cachedAccess) return null;
		return getOfflineAccess({
			access: cachedAccess.access,
			now,
			verifiedAt: cachedAccess.verifiedAt,
		})
			? cachedAccess.access
			: getExpiredOfflineSnapshot(cachedAccess);
	}, [cachedAccess, now]);

	const refreshAccess = retainedAccess
		? !retainedAccess.access.canUseApp ||
			getOfflineAccess({ ...retainedAccess, now })
			? retainedAccess.access
			: getExpiredOfflineSnapshot(retainedAccess)
		: undefined;
	const access =
		(canQuery ? serverAccess : undefined) ??
		refreshAccess ??
		(isCacheLoaded && didQueryTimeout
			? (offlineAccess ?? getExpiredOfflineSnapshot(null))
			: undefined);
	const isAccessLoading =
		Boolean(user) &&
		!isSessionLoading &&
		isOnboardingSettled(onboardingCompletionStatus) &&
		!access &&
		(!isCacheLoaded || !didQueryTimeout);

	const activateTrial = useCallback(
		async (termsVersion: string) => {
			await activateMyTrial({ termsVersion });
			const refreshedAt = Date.now();
			setNow(refreshedAt);
			setQueryNow(refreshedAt);
		},
		[activateMyTrial],
	);

	const refreshPaidAccess = useCallback(async () => {
		const result = await syncMyEntitlement({});
		const refreshedAt = Date.now();
		setNow(refreshedAt);
		setQueryNow(refreshedAt);
		return result.active;
	}, [syncMyEntitlement]);

	const value = useMemo(
		() => ({
			access,
			activateTrial,
			isAccessLoading,
			refreshPaidAccess,
		}),
		[access, activateTrial, isAccessLoading, refreshPaidAccess],
	);

	return (
		<AccessContext.Provider value={value}>{children}</AccessContext.Provider>
	);
}

export const useAccess = () => {
	const value = useContext(AccessContext);
	if (!value) {
		throw new Error("useAccess must be used within AccessProvider");
	}
	return value;
};
