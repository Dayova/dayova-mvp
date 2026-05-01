import "~/global.css";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ThemeProvider } from "@react-navigation/native";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useColorScheme } from "nativewind";
import {
  AuthProvider,
  AuthSessionProvider,
  useAuth,
  useConvexWorkosAuth,
} from "~/context/AuthContext";
import { NAV_THEME } from "~/lib/theme";
import { PortalHost } from "@rn-primitives/portal";

// Fallback for the build phase.
const convexUrl =
  process.env.EXPO_PUBLIC_CONVEX_URL || "https://placeholder.convex.cloud";
const convex = new ConvexReactClient(convexUrl);

function AppNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/login");
      return;
    }

    if (user && inAuthGroup) {
      router.replace("/home");
    }
  }, [isLoading, router, segments, user]);

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

  return (
    <AuthSessionProvider>
      <ConvexProviderWithAuth client={convex} useAuth={useConvexWorkosAuth}>
        <ThemeProvider value={theme}>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </ThemeProvider>
      </ConvexProviderWithAuth>
    </AuthSessionProvider>
  );
}
