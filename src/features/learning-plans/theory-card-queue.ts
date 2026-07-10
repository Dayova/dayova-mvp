export type TheoryCardQueueState<TCardId extends string> = {
	queue: TCardId[];
	currentIndex: number;
};

export const createTheoryCardQueue = <TCardId extends string>(
	cardIds: TCardId[],
): TheoryCardQueueState<TCardId> => ({
	queue: [...cardIds],
	currentIndex: 0,
});

export const repeatCurrentTheoryCard = <TCardId extends string>(
	state: TheoryCardQueueState<TCardId>,
): TheoryCardQueueState<TCardId> => {
	const currentCardId = state.queue[state.currentIndex];
	if (!currentCardId) return state;

	return {
		queue: [...state.queue, currentCardId],
		currentIndex: Math.min(state.currentIndex + 1, state.queue.length),
	};
};

export const understandCurrentTheoryCard = <TCardId extends string>(
	state: TheoryCardQueueState<TCardId>,
) => {
	const nextIndex = state.currentIndex + 1;

	return {
		isComplete: nextIndex >= state.queue.length,
		state: {
			queue: state.queue,
			currentIndex: Math.min(nextIndex, Math.max(state.queue.length - 1, 0)),
		},
	};
};
