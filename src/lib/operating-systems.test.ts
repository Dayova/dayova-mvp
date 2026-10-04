import { expect, test } from "vitest";
import { getOperatingSystem } from "./operating-systems";

test("maps native devices to the existing Notion OS options without guessing on web", () => {
	expect(getOperatingSystem("android")).toBe("Android");
	expect(getOperatingSystem("ios", false)).toBe("iOS");
	expect(getOperatingSystem("ios", true)).toBe("iPadOS");
	expect(getOperatingSystem("web")).toBeUndefined();
	expect(getOperatingSystem("windows")).toBeUndefined();
});
