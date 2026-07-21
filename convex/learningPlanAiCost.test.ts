import { expect, test } from "vitest";
import { estimateGeminiCostUsdMicros } from "./learningPlanAiCost";

test("estimates Flash and Flash-Lite costs including cached input", () => {
	expect(
		estimateGeminiCostUsdMicros({
			modelId: "gemini-3-flash-preview",
			inputTokens: 10_000,
			cachedInputTokens: 2_000,
			outputTokens: 4_000,
		}),
	).toBe(16_100);
	expect(
		estimateGeminiCostUsdMicros({
			modelId: "gemini-3.1-flash-lite",
			inputTokens: 10_000,
			cachedInputTokens: 2_000,
			outputTokens: 4_000,
		}),
	).toBe(8_050);
});
