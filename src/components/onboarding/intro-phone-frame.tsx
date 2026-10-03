import type { ReactNode } from "react";
import { View } from "react-native";
import { useDayovaTheme } from "~/lib/theme";

/** Decorative hardware, matched to the supplied light/dark device reference. */
export function IntroPhoneFrame({
	children,
	width,
	height,
	testID,
}: {
	children: ReactNode;
	width: number;
	height: number;
	testID: string;
}) {
	const { isDark, colors } = useDayovaTheme();
	const scale = Math.min(width / 365, height / 550);
	// Hardware finishes are illustration colors, not new product surface tokens.
	const shell = isDark ? "#1D1D1F" : "#F2F2F5";
	const screen = isDark ? "#000000" : "#FFFFFF";
	return (
		<View
			testID={testID}
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			pointerEvents="none"
			className="items-center justify-center"
			// The fixed artboard is uniformly fitted to the native page bounds.
			style={{ width, height }}
		>
			<View
				className="h-[550px] w-[365px] overflow-hidden rounded-t-[60px]"
				// Theme-aware hardware fill and responsive artboard scale.
				style={{
					backgroundColor: shell,
					experimental_backgroundImage: `linear-gradient(to bottom, ${shell} 20%, ${colors.background} 100%)`,
					transform: [{ scale }],
				}}
			>
				<View
					className="absolute inset-x-4 top-4 bottom-0 rounded-t-[44px]"
					// The reference uses a white/black device screen in each theme.
					style={{
						backgroundColor: screen,
						experimental_backgroundImage: `linear-gradient(155deg, ${screen} 20%, ${colors.background} 100%)`,
					}}
				/>
				<View
					className="absolute top-6 h-7 w-24 flex-row items-center justify-end self-center rounded-full px-2"
					// The island shares the device finish rather than a product control color.
					style={{ backgroundColor: shell }}
				>
					<View className="h-2 w-2 rounded-full bg-border" />
				</View>
				<View className="flex-1 overflow-hidden px-8 pt-16 pb-6">
					{children}
				</View>
			</View>
		</View>
	);
}
