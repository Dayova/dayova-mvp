import { describe, expect, test } from "vitest";
import {
	LEARNING_SESSION_COMPOSITION_FLAG,
	resolveLearningSessionCompositionVariant,
} from "./session-experiment";

describe("learning session composition experiment", () => {
	test("uses the PostHog split variant only when explicitly assigned", () => {
		expect(LEARNING_SESSION_COMPOSITION_FLAG).toBe(
			"learning-session-composition",
		);
		expect(resolveLearningSessionCompositionVariant("split")).toBe("split");
		expect(resolveLearningSessionCompositionVariant("test")).toBe("split");
	});

	test("falls back to control while the draft flag is unavailable", () => {
		expect(resolveLearningSessionCompositionVariant(undefined)).toBe("control");
		expect(resolveLearningSessionCompositionVariant(false)).toBe("control");
		expect(resolveLearningSessionCompositionVariant("unknown")).toBe("control");
	});
});
