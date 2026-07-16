type LearningPathFrameInput = {
	availableWidth: number;
	pathHeight: number;
	pathWidth: number;
};

type LearningPathFrame = {
	height: number;
	scale: number;
	width: number;
};

function getLearningPathFrame({
	availableWidth,
	pathHeight,
	pathWidth,
}: LearningPathFrameInput): LearningPathFrame {
	const scale = Math.min(1, Math.max(0, availableWidth) / pathWidth);

	return {
		height: pathHeight * scale,
		scale,
		width: pathWidth * scale,
	};
}

export { getLearningPathFrame };
