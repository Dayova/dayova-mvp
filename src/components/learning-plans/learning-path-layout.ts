export type LearningPathNodeState = "completed" | "current" | "locked";

export type LearningPathNodeFrame = {
	left: number;
	top: number;
	width: number;
	height: number;
};

type LearningPathSessionStatus = {
	completed: boolean;
};

export const LEARNING_PATH_WIDTH = 345;

const NODE_FRAME_WIDTH = 96;
const NODE_FRAME_HEIGHT = 88;
const NODE_TOP_INSET = 12;
const NODE_VERTICAL_STEP = 96;
const PATH_BOTTOM_INSET = 28;
const HORIZONTAL_WAVE = [0, -74, -112, -74, 0, 74, 112, 74] as const;

export function getLearningPathNodeFrame(index: number): LearningPathNodeFrame {
	const safeIndex = Math.max(0, index);
	const waveIndex = safeIndex % HORIZONTAL_WAVE.length;
	const centerOffset = HORIZONTAL_WAVE[waveIndex] ?? 0;

	return {
		left: LEARNING_PATH_WIDTH / 2 + centerOffset - NODE_FRAME_WIDTH / 2,
		top: NODE_TOP_INSET + safeIndex * NODE_VERTICAL_STEP,
		width: NODE_FRAME_WIDTH,
		height: NODE_FRAME_HEIGHT,
	};
}

export function getLearningPathHeight(sessionCount: number) {
	if (sessionCount <= 0) return 0;

	const lastFrame = getLearningPathNodeFrame(sessionCount - 1);
	return lastFrame.top + lastFrame.height + PATH_BOTTOM_INSET;
}

export function getCurrentLearningPathIndex(
	sessions: LearningPathSessionStatus[],
) {
	const firstIncompleteIndex = sessions.findIndex(
		(session) => !session.completed,
	);
	return firstIncompleteIndex === -1 ? null : firstIncompleteIndex;
}

export function getLearningPathNodeState(
	session: LearningPathSessionStatus,
	index: number,
	currentIndex: number | null,
): LearningPathNodeState {
	if (session.completed) return "completed";
	if (currentIndex !== null && index === currentIndex) return "current";
	return "locked";
}
