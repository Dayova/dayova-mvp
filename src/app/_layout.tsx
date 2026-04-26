import "~/global.css";
import { Stack } from "expo-router";
import { ThemeProvider } from "@react-navigation/native";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useColorScheme } from "nativewind";
import {
  AuthProvider,
  AuthSessionProvider,
  useConvexWorkosAuth,
} from "~/context/AuthContext";
import { NAV_THEME } from "~/lib/theme";
import { PortalHost } from "@rn-primitives/portal";

// Fallback for the build phase.
const convexUrl =
  process.env.EXPO_PUBLIC_CONVEX_URL || "https://placeholder.convex.cloud";
const convex = new ConvexReactClient(convexUrl);

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const theme = NAV_THEME[colorScheme ?? "light"];

  return (
    <AuthSessionProvider>
      <ConvexProviderWithAuth client={convex} useAuth={useConvexWorkosAuth}>
        <ThemeProvider value={theme}>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false }} />
            <PortalHost />
          </AuthProvider>
        </ThemeProvider>
      </ConvexProviderWithAuth>
    </AuthSessionProvider>
  );
}
