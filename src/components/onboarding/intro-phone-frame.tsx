import type { ReactNode } from "react";
import { View } from "react-native";

/** Decorative device chrome. Children remain real product presentation modules. */
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
	const scale = Math.min(width / 345, height / 550);
	return (
		<View
			testID={testID}
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			pointerEvents="none"
			className="items-center justify-center"
			// Fit one fixed device artboard into the available native page.
			style={{ width, height }}
		>
			<View
				className="h-[550px] w-[345px] rounded-[52px] border-[10px] border-muted bg-background shadow-black/5 shadow-sm"
				// Scale the entire device, including its decorative text, uniformly.
				style={{ transform: [{ scale }] }}
			>
				<View className="absolute top-3 h-6 w-24 flex-row items-center justify-end self-center rounded-full bg-muted px-2">
					<View className="h-2 w-2 rounded-full bg-border" />
				</View>
				<View className="flex-1 overflow-hidden rounded-[40px] px-4 pt-14 pb-6">
					{children}
				</View>
				<View className="absolute bottom-2 h-1 w-24 self-center rounded-full bg-border" />
			</View>
		</View>
	);
}
