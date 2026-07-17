type AsyncActionRunResult<T> =
	| { status: "completed"; value: T }
	| { status: "skipped" };

function createAsyncActionGate() {
	let isRunning = false;

	return {
		get isRunning() {
			return isRunning;
		},
		async run<T>(action: () => Promise<T>): Promise<AsyncActionRunResult<T>> {
			if (isRunning) return { status: "skipped" };
			isRunning = true;
			try {
				return { status: "completed", value: await action() };
			} finally {
				isRunning = false;
			}
		},
	};
}

export { createAsyncActionGate };
