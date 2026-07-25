type GeminiUsageCostInput = {
	modelId: string;
	inputTokens: number;
	cachedInputTokens?: number;
	outputTokens: number;
};

const pricesPerMillionTokens = {
	flash: { input: 0.5, cachedInput: 0.05, output: 3 },
	flashLite: { input: 0.25, cachedInput: 0.025, output: 1.5 },
} as const;

const finiteTokenCount = (value: number | undefined) =>
	Number.isFinite(value) ? Math.max(0, Math.floor(value ?? 0)) : 0;

export const estimateGeminiCostUsdMicros = ({
	modelId,
	inputTokens,
	cachedInputTokens,
	outputTokens,
}: GeminiUsageCostInput) => {
	const prices = modelId.includes("flash-lite")
		? pricesPerMillionTokens.flashLite
		: pricesPerMillionTokens.flash;
	const cached = Math.min(
		finiteTokenCount(inputTokens),
		finiteTokenCount(cachedInputTokens),
	);
	const uncached = finiteTokenCount(inputTokens) - cached;

	// A per-million-token USD price multiplied by tokens is numerically equal
	// to USD micros, which keeps persisted estimates integer and aggregation-safe.
	return Math.round(
		uncached * prices.input +
			cached * prices.cachedInput +
			finiteTokenCount(outputTokens) * prices.output,
	);
};
