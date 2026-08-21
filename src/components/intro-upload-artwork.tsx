import { View } from "react-native";
import {
	MaterialUploadActionCard,
	MaterialUploadStepLead,
} from "~/features/learning-plans/learning-plan-setup-steps";

const ARTWORK_WIDTH = 345;
const ARTWORK_HEIGHT = 313;

type IntroUploadArtworkProps = {
	height?: number;
	width?: number;
};

export function IntroUploadArtwork({
	width = ARTWORK_WIDTH,
	height = ARTWORK_HEIGHT,
}: IntroUploadArtworkProps) {
	const scale = Math.min(width / ARTWORK_WIDTH, height / ARTWORK_HEIGHT);

	return (
		<View
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			className="items-center justify-center"
			// The artwork frame dimensions are runtime component inputs.
			style={{ width, height }}
			testID="intro-upload-artwork"
		>
			<View
				className="h-[313px] w-[345px] justify-center rounded-[32px] bg-background px-5 py-6 shadow-black/10 shadow-sm"
				// The fixed artboard scales to the runtime frame while preserving its geometry.
				style={{ transform: [{ scale }] }}
			>
				<MaterialUploadStepLead mode="artwork" />
				<MaterialUploadActionCard hasSchoolMaterial={false} mode="artwork" />
			</View>
		</View>
	);
}
