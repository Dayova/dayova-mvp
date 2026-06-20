import { DefaultTheme, type Theme } from "expo-router/react-navigation";

export const NAV_THEME: Theme = {
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
};
