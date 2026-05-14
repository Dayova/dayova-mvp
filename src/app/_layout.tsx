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
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "~/context/AuthContext";
import { OnboardingProvider } from "~/context/OnboardingContext";
import { NAV_THEME } from "~/lib/theme";

// Fallback for the build phase.
const convexUrl =
	process.env.EXPO_PUBLIC_CONVEX_URL || "https://placeholder.convex.cloud";
const convex = new ConvexReactClient(convexUrl);
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
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

export default function RootLayout() {
	const { colorScheme } = useColorScheme();
	const theme = NAV_THEME[colorScheme ?? "light"];

	if (!clerkPublishableKey) {
		throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
	}

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<ClerkProvider
				publishableKey={clerkPublishableKey}
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
		</GestureHandlerRootView>
	);
}
