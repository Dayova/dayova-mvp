import { Stack, useRouter } from "expo-router";
import { BackButton } from "~/components/ui/button";
import { goBackOrReplace } from "~/lib/navigation";
import { ROUTES } from "~/lib/routes";
import { useDayovaTheme } from "~/lib/theme";

export default function AnalyticsLayout() {
	const router = useRouter();
	const { colors } = useDayovaTheme();

	return (
		<Stack
			screenOptions={{
				contentStyle: { backgroundColor: colors.background },
				gestureEnabled: true,
				headerBackButtonDisplayMode: "minimal",
				headerLeft: () => (
					<BackButton
						className="h-10 min-h-10 w-10 min-w-10"
						iconSize={18}
						onPress={() => goBackOrReplace(router, ROUTES.analytics)}
					/>
				),
				headerShadowVisible: false,
				headerStyle: { backgroundColor: colors.background },
				headerTintColor: colors.text,
				headerTitleStyle: {
					color: colors.text,
					fontFamily: "Poppins",
					fontWeight: "600",
				},
			}}
		>
			<Stack.Screen name="wissensstand" options={{ title: "Wissensstand" }} />
			<Stack.Screen name="lernhuerde" options={{ title: "Deine Lernhürde" }} />
			<Stack.Screen
				name="naechster-schritt"
				options={{ title: "Dein nächster Schritt" }}
			/>
			<Stack.Screen
				name="development"
				options={{ title: "Deine Entwicklung" }}
			/>
		</Stack>
	);
}
