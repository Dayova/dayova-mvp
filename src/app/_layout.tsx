import "~/global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { ThemeProvider } from "@react-navigation/native";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useColorScheme } from "nativewind";
import { AuthProvider, useAuth } from "~/context/AuthContext";
import { NAV_THEME } from "~/lib/theme";
import { PortalHost } from "@rn-primitives/portal";

// Fallback for the build phase.
const convexUrl =
  process.env.EXPO_PUBLIC_CONVEX_URL || "https://placeholder.convex.cloud";
const convex = new ConvexReactClient(convexUrl);
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function AppNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const { user, isSessionLoading } = useAuth();

  useEffect(() => {
    if (isSessionLoading) return;

    const isAuthRoute = segments[0] === "(auth)";
    if (!user && !isAuthRoute) {
      router.replace("/login");
      return;
    }
    if (user && isAuthRoute) {
      router.replace("/home");
    }
  }, [isSessionLoading, router, segments, user]);

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
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </ThemeProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
