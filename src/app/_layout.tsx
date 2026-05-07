import "~/global.css";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import {
	Stack,
	useRootNavigationState,
	useRouter,
	useSegments,
} from "expo-router";
import { useColorScheme } from "nativewind";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "~/context/AuthContext";
import { OnboardingProvider } from "~/context/OnboardingContext";
import { NAV_THEME } from "~/lib/theme";

// Fallback for the build phase.
const convexUrl =
	process.env.EXPO_PUBLIC_CONVEX_URL || "https://placeholder.convex.cloud";
const convex = new ConvexReactClient(convexUrl);
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function AppNavigator() {
	const router = useRouter();
	const segments = useSegments();
	const rootNavigationState = useRootNavigationState();
	const { user, isSessionLoading } = useAuth();

	useEffect(() => {
		if (isSessionLoading || !rootNavigationState?.key) return;

		const isAuthRoute = segments[0] === "(auth)";
		const targetRoute =
			!user && !isAuthRoute ? "/login" : user && isAuthRoute ? "/home" : null;
		if (!targetRoute) return;

		const frame = requestAnimationFrame(() => {
			router.replace(targetRoute);
		});

		return () => cancelAnimationFrame(frame);
	}, [isSessionLoading, rootNavigationState?.key, router, segments, user]);

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
		<ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
			<ConvexProviderWithClerk client={convex} useAuth={useClerkAuth}>
				<ThemeProvider value={theme}>
					<OnboardingProvider>
						<AuthProvider>
							<AppNavigator />
						</AuthProvider>
					</OnboardingProvider>
				</ThemeProvider>
			</ConvexProviderWithClerk>
		</ClerkProvider>
	);
}
