import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const GLOBAL_CSS_PATH = resolve(process.cwd(), "src/global.css");

describe("theme CSS", () => {
	test("declares dark variables on the NativeWind root selector", () => {
		const css = readFileSync(GLOBAL_CSS_PATH, "utf8");

		expect(css).toContain(".dark:root");
		expect(css).not.toContain("\n\t.dark {\n");
	});
});
