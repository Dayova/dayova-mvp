import { describe, expect, test } from "vitest";
import { meetsPasswordRequirements } from "./password-validation";

describe("meetsPasswordRequirements", () => {
	test("counts every credential character without silently trimming it", () => {
		expect(meetsPasswordRequirements(" sicher ")).toBe(true);
		expect(meetsPasswordRequirements(" kurz ")).toBe(false);
	});

	test("rejects empty and whitespace-only credentials", () => {
		expect(meetsPasswordRequirements("")).toBe(false);
		expect(meetsPasswordRequirements("        ")).toBe(false);
	});
});
