import { View } from "react-native";
import type { SvgProps } from "react-native-svg";
import { LearningPlanCardVisual } from "~/features/learning-plans/learning-plan-card-visual";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

const ARTWORK_WIDTH = 368;
const ARTWORK_HEIGHT = 211;

function numericDimension(
	value: SvgProps["width"] | SvgProps["height"],
	fallback: number,
) {
	return typeof value === "number" ? value : fallback;
}

export function IntroPlanArtwork({ width, height }: SvgProps) {
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
			testID="intro-plan-artwork"
		>
			<View className="h-[211px] w-[368px]" style={{ transform: [{ scale }] }}>
				<LearningPlanCardVisual
					mode="artwork"
					model={{
						subject: "Mathematik",
						status: {
							label: "Heute",
							background: DAYOVA_DESIGN_SYSTEM.colors.systemSubtle,
							foreground: DAYOVA_DESIGN_SYSTEM.colors.primary,
						},
						examDateLabel: "Klassenarbeit · 24. August",
						currentTitle: "Lineare Funktionen verstehen",
						durationMinutes: 30,
						needsSchoolMaterial: false,
						progress: 42,
						remainingDays: 10,
						rollingWindowLabel: "3 nächste Lernschritte",
					}}
				/>
			</View>
		</View>
	);
}
