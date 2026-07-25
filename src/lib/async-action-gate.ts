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

function createKeyedAsyncActionGate<Key>() {
	const gates = new Map<Key, ReturnType<typeof createAsyncActionGate>>();

	return {
		async run<T>(
			key: Key,
			action: () => Promise<T>,
		): Promise<AsyncActionRunResult<T>> {
			const gate = gates.get(key) ?? createAsyncActionGate();
			gates.set(key, gate);

			try {
				return await gate.run(action);
			} finally {
				if (!gate.isRunning && gates.get(key) === gate) {
					gates.delete(key);
				}
			}
		},
	};
}

export { createAsyncActionGate, createKeyedAsyncActionGate };
