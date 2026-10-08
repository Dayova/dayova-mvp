import { useConvexAuth } from "convex/react";
import { usePathname, useSegments } from "expo-router";
import * as Updates from "expo-updates";
import { usePostHog } from "posthog-react-native";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react";
import { AppState } from "react-native";
import { useAuthSession } from "~/context/AuthContext";
import {
	createValidationAnalytics,
	isPostHogConfigured,
} from "~/lib/analytics";
import { analyticsScreenForSegments } from "~/lib/feature-analytics";
import {
	FeatureAnalyticsContext,
	type TrackFeatureInteraction,
} from "~/lib/use-feature-analytics";

export function FeatureAnalyticsProvider({
	children,
}: {
	children: ReactNode;
}) {
	const posthog = usePostHog();
	const { user, isSessionLoading } = useAuthSession();
	const { isAuthenticated } = useConvexAuth();
	const segments = useSegments();
	// Local navigation identity only; never include a pathname in the payload.
	const pathname = usePathname();
	const screen = analyticsScreenForSegments(segments);
	const identity =
		!isSessionLoading && isAuthenticated ? user?.clerkId : undefined;
	const analytics = useMemo(
		() =>
			createValidationAnalytics(posthog, {
				configured: isPostHogConfigured,
				distinctId: identity,
				sharedContext: {
					validationStudentCode: user?.validationStudentCode,
					easUpdateId: Updates.updateId,
					easChannel: Updates.channel,
					easRuntimeVersion: Updates.runtimeVersion,
					easIsEmbeddedLaunch: Updates.isEmbeddedLaunch,
				},
			}),
		[posthog, identity, user?.validationStudentCode],
	);
	const currentScreen = useRef(screen);
	useLayoutEffect(() => {
		currentScreen.current = screen;
	}, [screen]);
	const currentIdentity = useRef(identity);
	useLayoutEffect(() => {
		currentIdentity.current = identity;
	}, [identity]);
	const track = useCallback<TrackFeatureInteraction>(
		(interaction, outcome = "performed", entityId, value) => {
			// Do not attribute an async completion from a signed-out account to the next account.
			if (!identity || currentIdentity.current !== identity) return;
			analytics.capture("feature_interaction", {
				interaction,
				outcome,
				...(entityId ? { entity_id: entityId } : {}),
				...(value ? { value } : {}),
				...(currentScreen.current ? { screen: currentScreen.current } : {}),
			});
		},
		[analytics, identity],
	);
	const lastScreen = useRef<string | null>(null);
	useEffect(() => {
		const key = identity && screen ? `${identity}:${pathname}` : null;
		if (!key || !screen) {
			lastScreen.current = null;
			return;
		}
		if (AppState.currentState === "active" && lastScreen.current !== key) {
			analytics.capture("app_screen_viewed", { screen });
			lastScreen.current = key;
		}
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "background") lastScreen.current = null;
			if (state === "active" && lastScreen.current !== key) {
				analytics.capture("app_screen_viewed", { screen });
				lastScreen.current = key;
			}
		});
		return () => subscription.remove();
	}, [analytics, identity, screen, pathname]);
	return (
		<FeatureAnalyticsContext.Provider value={track}>
			{children}
		</FeatureAnalyticsContext.Provider>
	);
}
