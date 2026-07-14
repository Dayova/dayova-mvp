import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const GLOBAL_CSS_PATH = resolve(process.cwd(), "src/global.css");
const APP_CONFIG_PATH = resolve(process.cwd(), "app.config.ts");

describe("theme CSS", () => {
	test("declares dark variables on the NativeWind root selector", () => {
		const css = readFileSync(GLOBAL_CSS_PATH, "utf8");

		expect(css).toContain(".dark:root");
		expect(css.match(/--progress-track:/g)).toHaveLength(2);
		expect(css).not.toContain("\n\t.dark {\n");
	});

	test("allows native light and dark appearance changes", () => {
		const appConfig = readFileSync(APP_CONFIG_PATH, "utf8");

		expect(appConfig).toMatch(/userInterfaceStyle:\s*"automatic"/);
	});
});
