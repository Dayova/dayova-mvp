const wait = (milliseconds: number) =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

const AUTH_SETTLE_RETRY_DELAYS = [0, 750, 1250, 2000] as const;

export const runWithAuthSettleRetries = async <TResult>(
	task: () => Promise<TResult>,
): Promise<
	| { ok: true; value: TResult }
	| { ok: false; firstError: unknown; lastError: unknown }
> => {
	let firstError: unknown;
	let lastError: unknown;

	for (const delay of AUTH_SETTLE_RETRY_DELAYS) {
		try {
			if (delay > 0) await wait(delay);
			return { ok: true, value: await task() };
		} catch (error) {
			firstError ??= error;
			lastError = error;
		}
	}

	return { ok: false, firstError, lastError };
};
