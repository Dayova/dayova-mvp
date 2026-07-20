import { useEffect, useState } from "react";
import type { ResolvedTheme } from "~/lib/theme-preference";
import DayovaSystemAppearance from "../../modules/dayova-system-appearance";

export function useSystemColorScheme(): ResolvedTheme {
	const [colorScheme, setColorScheme] = useState<ResolvedTheme>(() =>
		DayovaSystemAppearance.getColorScheme(),
	);

	useEffect(() => {
		const subscription = DayovaSystemAppearance.addListener(
			"onChange",
			(event) => setColorScheme(event.colorScheme),
		);

		return () => subscription.remove();
	}, []);

	return colorScheme;
}
