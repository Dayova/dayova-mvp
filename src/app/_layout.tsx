import "~/global.css";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { PortalHost } from "@rn-primitives/portal";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import * as SystemUI from "expo-system-ui";
import {
	Stack,
	usePathname,
	useRootNavigationState,
	useRouter,
} from "expo-router";
import { ThemeProvider } from "expo-router/react-navigation";
import { PostHogProvider } from "posthog-react-native";
import { useEffect } from "react";
import { Text, View, type ViewStyle } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AnalyticsIdentity } from "~/components/analytics-identity";
import { NotificationSync } from "~/components/notification-sync";
import {
	SheetAccessibilityProvider,
	useSheetAccessibility,
} from "~/components/ui/sheet-accessibility";
import { AuthProvider, useAuthSession } from "~/context/AuthContext";
import { OnboardingProvider } from "~/context/OnboardingContext";
import {
	isPostHogConfigured,
	postHogApiKey,
	postHogHost,
} from "~/lib/analytics-core";
import { env, missingPublicRuntimeConfig } from "~/lib/runtime-config";
import { getAuthNavigationTarget } from "~/lib/auth-routing";
import { DayovaThemeProvider, NAV_THEMES, useDayovaTheme } from "~/lib/theme";

const convexUrl = env.EXPO_PUBLIC_CONVEX_URL?.trim();
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;
function AppNavigator() {
	const router = useRouter();
	const pathname = usePathname();
	const rootNavigationState = useRootNavigationState();
	const { user, isSessionLoading, pendingSessionTask } = useAuthSession();
	const sheetAccessibility = useSheetAccessibility();

	useEffect(() => {
		if (isSessionLoading || !rootNavigationState?.key) return;

		const targetRoute = getAuthNavigationTarget({
			hasUser: Boolean(user),
			isSessionLoading,
			pathname,
			pendingSessionTask,
		});
		if (!targetRoute) return;

		const frame = requestAnimationFrame(() => {
			router.replace(targetRoute);
		});

		return () => cancelAnimationFrame(frame);
	}, [
		isSessionLoading,
		pathname,
		pendingSessionTask,
		rootNavigationState?.key,
		router,
		user,
	]);

	return (
		<>
			<NotificationSync />
			<View
				className="flex-1"
				accessibilityElementsHidden={sheetAccessibility?.hasOpenSheet ?? false}
				importantForAccessibility={
					sheetAccessibility?.hasOpenSheet ? "no-hide-descendants" : "auto"
				}
			>
				<Stack screenOptions={{ headerShown: false }} />
				<PortalHost />
			</View>
		</>
	);
}

function MissingConfigurationScreen() {
	return (
		<GestureHandlerRootView style={gestureRootStyle}>
			<View className="flex-1 items-center justify-center bg-background px-6">
				<Text className="text-center font-poppins font-semibold text-body-1 text-text">
					App kann nicht starten
				</Text>
				<Text className="mt-3 text-center font-poppins text-body-2 text-secondary-text">
					Dayova ist gerade nicht richtig konfiguriert. Bitte aktualisiere die
					App und versuche es erneut.
				</Text>
			</View>
		</GestureHandlerRootView>
	);
}

export default function RootLayout() {
	if (missingPublicRuntimeConfig.length > 0 || !convex) {
		const missingConfigKeys =
			missingPublicRuntimeConfig.length > 0
				? missingPublicRuntimeConfig
				: ["EXPO_PUBLIC_CONVEX_URL"];
		console.error(
			`Missing public runtime config: ${missingConfigKeys.join(", ")}`,
		);
		return <MissingConfigurationScreen />;
	}

	return (
		<DayovaThemeProvider>
			<RootProviders convexClient={convex} />
		</DayovaThemeProvider>
	);
}

function RootProviders({ convexClient }: { convexClient: ConvexReactClient }) {
	const { colors, resolvedTheme } = useDayovaTheme();

	useEffect(() => {
		void SystemUI.setBackgroundColorAsync(colors.background);
	}, [colors.background]);

	return (
		<GestureHandlerRootView style={gestureRootStyle}>
			<KeyboardProvider preload={false}>
				<PostHogProvider
					apiKey={postHogApiKey}
					autocapture={false}
					options={{
						host: postHogHost,
						disabled: !isPostHogConfigured,
						captureAppLifecycleEvents: false,
					}}
				>
					<ClerkProvider
						publishableKey={env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? ""}
						tokenCache={tokenCache}
					>
						<ConvexProviderWithClerk
							client={convexClient}
							useAuth={useClerkAuth}
						>
							<ThemeProvider value={NAV_THEMES[resolvedTheme]}>
								<BottomSheetModalProvider>
									<SheetAccessibilityProvider>
										<OnboardingProvider>
											<AuthProvider>
												<AnalyticsIdentity />
												<AppNavigator />
											</AuthProvider>
										</OnboardingProvider>
									</SheetAccessibilityProvider>
								</BottomSheetModalProvider>
							</ThemeProvider>
						</ConvexProviderWithClerk>
					</ClerkProvider>
				</PostHogProvider>
			</KeyboardProvider>
		</GestureHandlerRootView>
	);
}

// GestureHandlerRootView is a third-party root host; keep this native style so
// the gesture tree fills the screen before NativeWind class processing applies.
const gestureRootStyle = { flex: 1 } satisfies ViewStyle;
