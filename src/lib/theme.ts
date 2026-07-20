import {
	DarkTheme,
	DefaultTheme,
	type Theme,
} from "expo-router/react-navigation";
import * as SecureStore from "expo-secure-store";
import {
	createContext,
	createElement,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { Appearance, Platform } from "react-native";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useSystemColorScheme } from "~/lib/system-color-scheme";
import {
	isThemePreference,
	type ResolvedTheme,
	resolveThemePreference,
	THEME_STORAGE_KEY,
	type ThemePreference,
} from "~/lib/theme-preference";

type DayovaThemeColors = {
	[Key in keyof typeof DAYOVA_DESIGN_SYSTEM.colors]: string;
};

const LIGHT_COLORS: DayovaThemeColors = DAYOVA_DESIGN_SYSTEM.colors;

const DARK_COLORS = {
	...LIGHT_COLORS,
	buttonNeutral: "#FFFFFF",
	text: "#EFECE7",
	secondaryText: "#A7AAB4",
	background: "#131217",
	appBackground: "#131217",
	surface: "#222127",
	light1: "#FFFFFF",
	light2: "#2B2A31",
	light3: "#34323A",
	mutedSurface: "#2B2A31",
	border: "#3A3942",
	successSubtle: "#163321",
	wrongSubtle: "#3A2512",
	infoSubtle: "#332B12",
	systemSubtle: "#0F2C36",
	theorieSubtle: "#25223B",
	uebenSubtle: "#30213A",
	praxisSubtle: "#123532",
	hausaufgabeSubtle: "#332433",
	path1: "#3A3942",
	path2: "#3A3942",
	path3: "#8D8F98",
	path4: "#A7AAB4",
} satisfies DayovaThemeColors;

const DAYOVA_THEME_COLORS = {
	light: LIGHT_COLORS,
	dark: DARK_COLORS,
} as const;

export const NAV_THEMES: Record<ResolvedTheme, Theme> = {
	light: {
		...DefaultTheme,
		colors: {
			...DefaultTheme.colors,
			background: "hsl(60 10% 96.1%)",
			border: "hsl(206.7 34.6% 89.8%)",
			card: "hsl(0 0% 100%)",
			notification: "hsl(35.1 100% 50%)",
			primary: "hsl(196.2 100% 50%)",
			text: "hsl(0 0% 10.2%)",
		},
	},
	dark: {
		...DarkTheme,
		colors: {
			...DarkTheme.colors,
			background: "hsl(250 10% 8%)",
			border: "hsl(224 12% 24%)",
			card: "hsl(248 10% 13%)",
			notification: "hsl(35.1 100% 58%)",
			primary: "hsl(196.2 100% 50%)",
			text: "hsl(36 15% 92%)",
		},
	},
};

type ThemeContextValue = {
	colors: (typeof DAYOVA_THEME_COLORS)[ResolvedTheme];
	isDark: boolean;
	isLoaded: boolean;
	preference: ThemePreference;
	resolvedTheme: ResolvedTheme;
	setPreference: (preference: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

async function readStoredThemePreference(): Promise<ThemePreference | null> {
	if (Platform.OS === "web") {
		const stored = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
		return isThemePreference(stored) ? stored : null;
	}

	const stored = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
	return isThemePreference(stored) ? stored : null;
}

async function writeStoredThemePreference(preference: ThemePreference) {
	if (Platform.OS === "web") {
		globalThis.localStorage?.setItem(THEME_STORAGE_KEY, preference);
		return;
	}

	await SecureStore.setItemAsync(THEME_STORAGE_KEY, preference);
}

function DayovaThemeProvider({ children }: { children: ReactNode }) {
	const systemTheme = useSystemColorScheme();
	const [preference, setPreferenceState] = useState<ThemePreference>("system");
	const [isLoaded, setIsLoaded] = useState(false);
	const resolvedTheme = resolveThemePreference(preference, systemTheme);
	const colors = DAYOVA_THEME_COLORS[resolvedTheme];

	useEffect(() => {
		let isActive = true;

		readStoredThemePreference()
			.then((storedPreference) => {
				if (!isActive) return;

				const nextPreference = storedPreference ?? "system";
				setPreferenceState(nextPreference);
			})
			.catch((error: unknown) => {
				console.warn("Unable to load Dayova theme preference", error);
			})
			.finally(() => {
				if (isActive) setIsLoaded(true);
			});

		return () => {
			isActive = false;
		};
	}, []);

	useEffect(() => {
		const nativePreference =
			preference === "system" ? "unspecified" : preference;
		Appearance.setColorScheme(nativePreference);
	}, [preference]);

	const setPreference = useCallback(async (nextPreference: ThemePreference) => {
		setPreferenceState(nextPreference);
		await writeStoredThemePreference(nextPreference);
	}, []);

	const value = useMemo(
		() => ({
			colors,
			isDark: resolvedTheme === "dark",
			isLoaded,
			preference,
			resolvedTheme,
			setPreference,
		}),
		[colors, isLoaded, preference, resolvedTheme, setPreference],
	);

	return createElement(ThemeContext.Provider, { value }, children);
}

function useDayovaTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useDayovaTheme must be used inside DayovaThemeProvider");
	}
	return context;
}

export { DayovaThemeProvider, useDayovaTheme };
