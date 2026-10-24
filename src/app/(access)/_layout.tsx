import { LinearGradient } from "expo-linear-gradient";
import { ThemeProvider, useTheme } from "expo-router/react-navigation";
import { Stack } from "expo-router/stack";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

const gradient = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
const surfaceStyle = {
	flex: 1,
	backgroundColor: DAYOVA_DESIGN_SYSTEM.colors.primaryStrong,
};
const contentStyle = {
	backgroundColor: DAYOVA_DESIGN_SYSTEM.colors.primaryStrong,
};

export default function AccessLayout() {
	const theme = useTheme();
	const navigationTheme = useMemo(
		() => ({
			...theme,
			colors: { ...theme.colors, background: "transparent" },
		}),
		[theme],
	);

	return (
		<View style={surfaceStyle}>
			{/* Native transitions can expose the stack container between screens.
			    Keep the branded backdrop stationary underneath both moving pages. */}
			<LinearGradient
				pointerEvents="none"
				colors={gradient.colors}
				start={gradient.start}
				end={gradient.end}
				style={StyleSheet.absoluteFill}
			/>
			<ThemeProvider value={navigationTheme}>
				<Stack
					screenOptions={{
						headerShown: false,
						animation: "default",
						contentStyle,
					}}
				>
					<Stack.Screen
						name="subscription"
						options={{ gestureEnabled: true }}
					/>
				</Stack>
			</ThemeProvider>
		</View>
	);
}
