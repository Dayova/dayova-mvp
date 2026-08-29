import { describe, expect, it } from "vitest";
import { areNativeStorePurchasesEnabled } from "./native-store-purchases";

describe("areNativeStorePurchasesEnabled", () => {
	it("keeps local development enabled when the flag is omitted", () => {
		expect(areNativeStorePurchasesEnabled()).toBe(true);
	});

	it("disables native purchases only when explicitly configured", () => {
		expect(areNativeStorePurchasesEnabled("false")).toBe(false);
		expect(areNativeStorePurchasesEnabled("true")).toBe(true);
	});
});
