import "~/global.css";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { PortalHost } from "@rn-primitives/portal";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { Stack } from "expo-router";
import { ThemeProvider } from "expo-router/react-navigation";
import * as SystemUI from "expo-system-ui";
import { vars } from "nativewind";
import { PostHogProvider } from "posthog-react-native";
import { useEffect, useMemo } from "react";
import { Text, View, type ViewStyle } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AnalyticsIdentity } from "~/components/analytics-identity";
import { AuthNavigationGate } from "~/components/auth-navigation-gate";
import { NotificationSync } from "~/components/notification-sync";
import {
	SheetAccessibilityProvider,
	useSheetAccessibility,
} from "~/components/ui/sheet-accessibility";
import { AuthProvider } from "~/context/AuthContext";
import { OnboardingProvider } from "~/context/OnboardingContext";
import {
	isPostHogConfigured,
	postHogApiKey,
	postHogHost,
} from "~/lib/analytics-core";
import { env, missingPublicRuntimeConfig } from "~/lib/runtime-config";
import { DayovaThemeProvider, NAV_THEMES, useDayovaTheme } from "~/lib/theme";
import { DARK_THEME_VARIABLES } from "~/lib/theme-variables";

const convexUrl = env.EXPO_PUBLIC_CONVEX_URL?.trim();
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;
function AppNavigator() {
	const sheetAccessibility = useSheetAccessibility();
	const { colors } = useDayovaTheme();

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
				<AuthNavigationGate>
					<Stack
						screenOptions={{
							headerShown: false,
							contentStyle: { backgroundColor: colors.background },
						}}
					>
						<Stack.Screen name="(auth)" options={{ animation: "none" }} />
						<Stack.Screen name="(app)" options={{ animation: "none" }} />
						<Stack.Screen
							name="learning-times/edit"
							options={{
								animation: "slide_from_right",
								contentStyle: { backgroundColor: colors.background },
								gestureEnabled: true,
								presentation: "card",
							}}
						/>
					</Stack>
				</AuthNavigationGate>
			</View>
			<PortalHost />
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
	const themeVariables = useMemo(
		() => vars(resolvedTheme === "dark" ? DARK_THEME_VARIABLES : {}),
		[resolvedTheme],
	);

	useEffect(() => {
		void SystemUI.setBackgroundColorAsync(colors.background);
	}, [colors.background]);

	return (
		<GestureHandlerRootView style={gestureRootStyle}>
			<View style={[gestureRootStyle, themeVariables]}>
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
						{/* Native sessions persist by default; there is no per-login opt-out.
						    Decision: https://app.notion.com/p/3a02e87228bf81bf9f65f6214759a770 */}
						<ClerkProvider
							publishableKey={
								env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? ""
							}
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
			</View>
		</GestureHandlerRootView>
	);
}

// GestureHandlerRootView is a third-party root host; keep this native style so
// the gesture tree fills the screen before NativeWind class processing applies.
const gestureRootStyle = { flex: 1 } satisfies ViewStyle;
