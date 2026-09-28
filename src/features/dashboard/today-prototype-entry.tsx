import "~/global.css";
// This opt-in entry replaces _layout.tsx and therefore owns its root provider.
// eslint-disable-next-line dayova-ui/no-direct-overlay-primitives
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { registerRootComponent } from "expo";
import { useFonts } from "expo-font";
import { vars } from "nativewind";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DayovaThemeProvider, useDayovaTheme } from "~/lib/theme";
import { DARK_THEME_VARIABLES } from "~/lib/theme-variables";
import { TodayDecisionPrototype } from "./today-decision-prototype";

function Surface() {
	const { isDark } = useDayovaTheme();
	return (
		<View
			className="flex-1 bg-background"
			style={isDark ? vars(DARK_THEME_VARIABLES) : undefined}
		>
			<BottomSheetModalProvider>
				<TodayDecisionPrototype />
			</BottomSheetModalProvider>
		</View>
	);
}

function TodayPrototypeApp() {
	const [loaded] = useFonts({
		Poppins: require("../../../assets/fonts/Poppins-Regular.ttf"),
		"Poppins-SemiBold": require("../../../assets/fonts/Poppins-SemiBold.ttf"),
	});
	if (!loaded) return null;
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<DayovaThemeProvider>
					<Surface />
				</DayovaThemeProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}

registerRootComponent(TodayPrototypeApp);
