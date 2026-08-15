import { View } from "react-native";
import type { SvgProps } from "react-native-svg";
import {
	MaterialUploadActionCard,
	MaterialUploadStepLead,
} from "~/features/learning-plans/learning-plan-setup-steps";

const ARTWORK_WIDTH = 345;
const ARTWORK_HEIGHT = 313;

function numericDimension(
	value: SvgProps["width"] | SvgProps["height"],
	fallback: number,
) {
	return typeof value === "number" ? value : fallback;
}

export function IntroUploadArtwork({ width, height }: SvgProps) {
	const resolvedWidth = numericDimension(width, ARTWORK_WIDTH);
	const resolvedHeight = numericDimension(height, ARTWORK_HEIGHT);
	const scale = Math.min(
		resolvedWidth / ARTWORK_WIDTH,
		resolvedHeight / ARTWORK_HEIGHT,
	);

	return (
		<View
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			className="items-center justify-center"
			style={{ width: resolvedWidth, height: resolvedHeight }}
			testID="intro-upload-artwork"
		>
			<View
				className="h-[313px] w-[345px] justify-center rounded-[32px] bg-background px-5 py-6 shadow-black/10 shadow-sm"
				style={{ transform: [{ scale }] }}
			>
				<MaterialUploadStepLead mode="artwork" />
				<MaterialUploadActionCard hasSchoolMaterial={false} mode="artwork" />
			</View>
		</View>
	);
}
