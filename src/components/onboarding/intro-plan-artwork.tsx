import { View } from "react-native";
import { LearningPlanCardVisual } from "~/features/learning-plans/learning-plan-card-visual";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

const ARTWORK_WIDTH = 368;
const ARTWORK_HEIGHT = 211;

type IntroPlanArtworkProps = {
	height?: number;
	width?: number;
};

export function IntroPlanArtwork({
	width = ARTWORK_WIDTH,
	height = ARTWORK_HEIGHT,
}: IntroPlanArtworkProps) {
	const scale = Math.min(width / ARTWORK_WIDTH, height / ARTWORK_HEIGHT);

	return (
		<View
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			className="items-center justify-center"
			// The artwork frame dimensions are runtime component inputs.
			style={{ width, height }}
			testID="intro-plan-artwork"
		>
			<View
				className="h-[211px] w-[368px]"
				// The fixed artboard scales to the runtime frame while preserving its geometry.
				style={{ transform: [{ scale }] }}
			>
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
						state: {
							kind: "ready",
							durationMinutes: 30,
							progress: 42,
							remainingDays: 10,
							rollingWindowLabel: "3 nächste Lernschritte",
						},
					}}
				/>
			</View>
		</View>
	);
}
