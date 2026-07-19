import { useColorScheme } from "react-native";
import type { ResolvedTheme } from "~/lib/theme-preference";

export function useSystemColorScheme(): ResolvedTheme {
	return useColorScheme() === "dark" ? "dark" : "light";
}
