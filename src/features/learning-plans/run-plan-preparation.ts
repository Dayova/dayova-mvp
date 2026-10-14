export type PreparationStage = 0 | 1 | 2 | 3;

type PreparationOptions = {
	questionsReady: boolean;
	scopeConfirmed: boolean;
	isCancelled: () => boolean;
	onStage: (stage: PreparationStage) => void;
	analyze: () => Promise<unknown>;
	confirm: () => Promise<unknown>;
	prepare: () => Promise<unknown>;
};

/** Learns presentation timing from successful full runs in this app session. */
export function createPlanPreparationRunner() {
	const recentDurations: number[] = [];
	return async (options: PreparationOptions) => {
		if (options.isCancelled()) return false;
		const initialStage: PreparationStage = !options.questionsReady
			? 0
			: !options.scopeConfirmed
				? 1
				: 2;
		const sorted = [...recentDurations].sort((a, b) => a - b);
		const estimate = sorted.length
			? sorted[Math.floor(sorted.length / 2)]
			: 15000;
		const startedAt = Date.now();
		options.onStage(initialStage);
		const timers: ReturnType<typeof setTimeout>[] = [];
		for (let next = initialStage + 1; next <= 2; next++) {
			const visualStage = next as PreparationStage;
			timers.push(
				setTimeout(
					() => {
						if (!options.isCancelled()) options.onStage(visualStage);
					},
					((next - initialStage) * estimate) / 3,
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
			for (const timer of timers) clearTimeout(timer);
		}
		if (options.isCancelled()) return false;
		if (initialStage === 0) {
			recentDurations.push(
				Math.min(60000, Math.max(1000, Date.now() - startedAt)),
			);
			if (recentDurations.length > 5) recentDurations.shift();
		}
		// Actual readiness always wins: no minimum stage or completed-state delay.
		options.onStage(3);
		return true;
	};
}

export const runPlanPreparation = createPlanPreparationRunner();
