export type PreparationStage = 0 | 1 | 2 | 3;

// Presentation estimates: the backend's first request performs most of the work.
const ESTIMATED_STAGE_DURATION_MS = 5000;
const MINIMUM_STAGE_DURATION_MS = 1500;
const COMPLETION_DURATION_MS = 600;
const wait = (duration: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, duration));

/** Estimated visual stages over one resumable, sequential backend pipeline. */
export async function runPlanPreparation(options: {
	questionsReady: boolean;
	scopeConfirmed: boolean;
	isCancelled: () => boolean;
	onStage: (stage: PreparationStage) => void;
	analyze: () => Promise<unknown>;
	confirm: () => Promise<unknown>;
	prepare: () => Promise<unknown>;
}) {
	if (options.isCancelled()) return false;
	let stage: PreparationStage = !options.questionsReady
		? 0
		: !options.scopeConfirmed
			? 1
			: 2;
	let stageStartedAt = Date.now();
	const showStage = (next: PreparationStage) => {
		stage = next;
		stageStartedAt = Date.now();
		options.onStage(next);
	};
	showStage(stage);
	const timers: ReturnType<typeof setTimeout>[] = [];
	for (let next = stage + 1; next <= 2; next++) {
		const visualStage = next as PreparationStage;
		timers.push(
			setTimeout(
				() => {
					if (!options.isCancelled()) showStage(visualStage);
				},
				(next - stage) * ESTIMATED_STAGE_DURATION_MS,
			),
		);
	}
	try {
		if (!options.questionsReady) await options.analyze();
		if (options.isCancelled()) return false;
		// Temporary product decision: apply recognized scope without a confirmation screen.
		if (!options.scopeConfirmed) await options.confirm();
		if (options.isCancelled()) return false;
		await options.prepare();
	} finally {
		// Errors and completion must stop estimated transitions immediately.
		for (const timer of timers) clearTimeout(timer);
	}
	if (options.isCancelled()) return false;
	// Fast results use only the existing readable minimum, not the full estimate.
	while (stage < 3) {
		const remaining = MINIMUM_STAGE_DURATION_MS - (Date.now() - stageStartedAt);
		if (remaining > 0) await wait(remaining);
		if (options.isCancelled()) return false;
		showStage((stage + 1) as PreparationStage);
	}
	await wait(COMPLETION_DURATION_MS);
	return !options.isCancelled();
}
