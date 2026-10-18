export type TokenUsage = {
	input?: number;
	cachedInput?: number;
	cacheWrite?: number;
	output?: number;
	reasoning?: number;
};
export type TokenPrices = {
	input: number;
	cachedInput: number;
	cacheWrite?: number;
	output: number;
};

// USD per million tokens. Exact IDs only; unknown models stay unpriced.
// Source and effective date are maintained alongside these rates in the runbook.
export const vertexPrices: Record<string, TokenPrices> = {
	"gemini-3-flash-preview": { input: 0.5, cachedInput: 0.05, output: 3 },
	"gemini-3.1-flash-lite": { input: 0.25, cachedInput: 0.025, output: 1.5 },
	"gemini-3.5-flash-lite": { input: 0.3, cachedInput: 0.03, output: 2.5 },
};

export const costForUsage = (
	modelId: string,
	usage: TokenUsage,
	prices = vertexPrices[modelId],
): number | undefined => {
	const { input, output } = usage;
	if (
		!prices ||
		input === undefined ||
		output === undefined ||
		!Number.isFinite(input) ||
		!Number.isFinite(output) ||
		input < 0 ||
		output < 0
	)
		return undefined;
	const cached = usage.cachedInput ?? 0;
	const written = usage.cacheWrite ?? 0;
	if (
		!Number.isFinite(cached) ||
		!Number.isFinite(written) ||
		cached < 0 ||
		written < 0 ||
		cached + written > input ||
		(written > 0 && prices.cacheWrite === undefined)
	)
		return undefined;
	// AI SDK's Google adapter sets outputTokens.total to candidatesTokenCount +
	// thoughtsTokenCount; OpenAI/Anthropic also expose inclusive totals. Never add
	// reasoning a second time. Raw provider responses must be normalized first.
	return (
		((input - cached - written) * prices.input +
			cached * prices.cachedInput +
			written * (prices.cacheWrite ?? 0) +
			output * prices.output) /
		1_000_000
	);
};
