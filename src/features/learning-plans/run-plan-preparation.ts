export type PreparationStage = 0 | 1 | 2 | 3;

const MINIMUM_STAGE_DURATION_MS = 1500;
const COMPLETION_DURATION_MS = 600;
const wait = (duration: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, duration));

/** One resumable pipeline; leaving the screen stops subsequent requests. */
export async function runPlanPreparation(options: {
	questionsReady: boolean;
	scopeConfirmed: boolean;
	isCancelled: () => boolean;
	onStage: (stage: PreparationStage) => void;
	analyze: () => Promise<unknown>;
	confirm: () => Promise<unknown>;
	prepare: () => Promise<unknown>;
}) {
	const runStage = async (
		stage: PreparationStage,
		work: () => Promise<unknown>,
	) => {
		if (options.isCancelled()) return false;
		const startedAt = Date.now();
		options.onStage(stage);
		await work();
		if (options.isCancelled()) return false;
		// Fast requests remain readable; slow requests never finish on a timer.
		const remaining = MINIMUM_STAGE_DURATION_MS - (Date.now() - startedAt);
		if (remaining > 0) await wait(remaining);
		return !options.isCancelled();
	};
	if (!options.questionsReady && !(await runStage(0, options.analyze)))
		return false;
	// Temporary product decision: apply recognized scope without a separate confirmation screen.
	if (!options.scopeConfirmed && !(await runStage(1, options.confirm)))
		return false;
	if (!(await runStage(2, options.prepare))) return false;
	options.onStage(3);
	await wait(COMPLETION_DURATION_MS);
	return !options.isCancelled();
}
