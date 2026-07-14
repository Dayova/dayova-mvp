import { StatusBar, type StatusBarProps } from "expo-status-bar";
import { useDayovaTheme } from "~/lib/theme";

function ThemedStatusBar(props: Omit<StatusBarProps, "style">) {
	const { isDark } = useDayovaTheme();

	return <StatusBar {...props} style={isDark ? "light" : "dark"} />;
}

export { ThemedStatusBar };
