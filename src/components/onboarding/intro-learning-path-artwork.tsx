import { View } from "react-native";
import {
	LearningPathVisual,
	type LearningPathArtworkNode,
} from "~/features/learning-plans/learning-path-visual";

const ARTWORK_WIDTH = 345;
const ARTWORK_HEIGHT = 276;

type IntroLearningPathArtworkProps = {
	height?: number;
	width?: number;
};

const learningPathPreview = [
	{
		id: "intro-path-completed",
		phase: "theory",
		state: "completed",
	},
	{
		id: "intro-path-current",
		phase: "practice",
		state: "current",
	},
	{
		id: "intro-path-locked",
		phase: "rehearsal",
		state: "locked",
	},
] satisfies readonly LearningPathArtworkNode[];

export function IntroLearningPathArtwork({
	width = ARTWORK_WIDTH,
	height = ARTWORK_HEIGHT,
}: IntroLearningPathArtworkProps) {
	return (
		<View
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			className="items-center justify-center"
			// Content-size layout provides the artwork's runtime frame dimensions.
			style={{ width, height }}
			testID="intro-learning-path-artwork"
		>
			<LearningPathVisual
				height={height}
				mode="artwork"
				nodes={learningPathPreview}
				width={width}
			/>
		</View>
	);
}
