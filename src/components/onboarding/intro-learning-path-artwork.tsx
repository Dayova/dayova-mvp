import { Text } from "~/components/ui/text";
import {
	type LearningPathArtworkNode,
	LearningPathVisual,
} from "~/features/learning-plans/learning-path-visual";
import { IntroPhoneFrame } from "./intro-phone-frame";

const ARTWORK_WIDTH = 345;
const ARTWORK_HEIGHT = 550;

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
		<IntroPhoneFrame
			width={width}
			height={height}
			testID="intro-learning-path-artwork"
		>
			<Text
				allowFontScaling={false}
				className="mb-3 text-center font-poppins font-semibold text-heading-2 text-text"
			>
				Dein Lernplan
			</Text>
			<LearningPathVisual
				mode="artwork"
				nodes={learningPathPreview}
				width={396}
				height={430}
				continuation={{
					examDateLabel: "Freitag, 30. Oktober",
					examCountdownLabel: "Noch 25 Tage",
				}}
			/>
		</IntroPhoneFrame>
	);
}
