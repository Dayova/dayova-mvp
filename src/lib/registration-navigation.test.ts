import { describe, expect, test } from "vitest";
import { shouldHandleRegistrationBack } from "./registration-navigation";

describe("shouldHandleRegistrationBack", () => {
	test("leaves the native entry-route gesture active on the first flow step", () => {
		expect(shouldHandleRegistrationBack(0, "flow")).toBe(false);
	});

	test("handles back inside registration after progress or a stage transition", () => {
		expect(shouldHandleRegistrationBack(1, "flow")).toBe(true);
		expect(shouldHandleRegistrationBack(0, "verification")).toBe(true);
		expect(shouldHandleRegistrationBack(0, "creating")).toBe(true);
	});
});
