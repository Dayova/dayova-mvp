export type PreparationStage = 0 | 1 | 2 | 3;

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
	if (options.isCancelled()) return;
	if (!options.questionsReady) {
		options.onStage(0);
		await options.analyze();
	}
	if (options.isCancelled()) return;
	options.onStage(1);
	// Temporary product decision: use the recognized scope without a separate confirmation screen.
	if (!options.scopeConfirmed) await options.confirm();
	if (options.isCancelled()) return;
	options.onStage(2);
	await options.prepare();
	if (!options.isCancelled()) options.onStage(3);
}
