import "~/global.css";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { PortalHost } from "@rn-primitives/portal";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import {
	Stack,
	usePathname,
	useRootNavigationState,
	useRouter,
} from "expo-router";
import { ThemeProvider } from "expo-router/react-navigation";
import { useColorScheme } from "nativewind";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AuthProvider, useAuth } from "~/context/AuthContext";
import { OnboardingProvider } from "~/context/OnboardingContext";
import { env, missingPublicRuntimeConfig } from "~/lib/runtime-config";
import { NAV_THEME } from "~/lib/theme";

// ConvexReactClient needs a syntactically valid URL even when config is absent.
const convex = new ConvexReactClient(
	env.EXPO_PUBLIC_CONVEX_URL?.trim() || "https://placeholder.convex.cloud",
);
const PUBLIC_AUTH_PATHS = new Set(["/", "/login", "/register", "/onboarding"]);

const isPublicAuthPath = (pathname: string) => PUBLIC_AUTH_PATHS.has(pathname);

function AppNavigator() {
	const router = useRouter();
	const pathname = usePathname();
	const rootNavigationState = useRootNavigationState();
	const { user, isSessionLoading } = useAuth();

	useEffect(() => {
		if (isSessionLoading || !rootNavigationState?.key) return;

		const isAuthRoute = isPublicAuthPath(pathname);
		const targetRoute =
			!user && !isAuthRoute ? "/" : user && isAuthRoute ? "/home" : null;
		if (!targetRoute) return;

		const frame = requestAnimationFrame(() => {
			router.replace(targetRoute);
		});

		return () => cancelAnimationFrame(frame);
	}, [isSessionLoading, pathname, rootNavigationState?.key, router, user]);

	return (
		<>
			<Stack screenOptions={{ headerShown: false }} />
			<PortalHost />
		</>
	);
}

function MissingConfigurationScreen() {
	return (
		<GestureHandlerRootView style={styles.root}>
			<View style={styles.configurationScreen}>
				<Text style={styles.configurationTitle}>App kann nicht starten</Text>
				<Text style={styles.configurationMessage}>
					Dayova ist gerade nicht richtig konfiguriert. Bitte aktualisiere die
					App und versuche es erneut.
				</Text>
			</View>
		</GestureHandlerRootView>
	);
}

export default function RootLayout() {
	const { colorScheme } = useColorScheme();
	const theme = NAV_THEME[colorScheme ?? "light"];

	if (missingPublicRuntimeConfig.length > 0) {
		console.error(
			`Missing public runtime config: ${missingPublicRuntimeConfig.join(", ")}`,
		);
		return <MissingConfigurationScreen />;
	}

	return (
		<GestureHandlerRootView style={styles.root}>
			<KeyboardProvider preload={false}>
				<ClerkProvider
					publishableKey={env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? ""}
					tokenCache={tokenCache}
				>
					<ConvexProviderWithClerk client={convex} useAuth={useClerkAuth}>
						<ThemeProvider value={theme}>
							<BottomSheetModalProvider>
								<OnboardingProvider>
									<AuthProvider>
										<AppNavigator />
									</AuthProvider>
								</OnboardingProvider>
							</BottomSheetModalProvider>
						</ThemeProvider>
					</ConvexProviderWithClerk>
				</ClerkProvider>
			</KeyboardProvider>
		</GestureHandlerRootView>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	configurationScreen: {
		alignItems: "center",
		backgroundColor: "#ffffff",
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: 24,
	},
	configurationTitle: {
		color: "#19191a",
		fontFamily: "Poppins",
		fontSize: 20,
		fontWeight: "600",
		textAlign: "center",
	},
	configurationMessage: {
		color: "#4b5563",
		fontFamily: "Poppins",
		fontSize: 15,
		lineHeight: 22,
		marginTop: 12,
		textAlign: "center",
	},
});
