import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import type { ExpoConfig } from "expo/config";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const APP_CONFIG_PATH = ["app.config.cts", "app.config.ts"]
	.map((filename) => resolve(process.cwd(), filename))
	.find(existsSync);

describe("Expo app config loading", () => {
	it("loads through Node's native TypeScript loader without mixing module formats", () => {
		expect(APP_CONFIG_PATH).toBeDefined();

		const result = spawnSync(
			process.execPath,
			[
				"--experimental-strip-types",
				"--input-type=module",
				"--eval",
				`await import(${JSON.stringify(pathToFileURL(APP_CONFIG_PATH ?? "").href)})`,
			],
			{
				cwd: process.cwd(),
				encoding: "utf8",
				env: {
					...process.env,
					APP_VARIANT: "preview",
				},
			},
		);

		expect(result.stderr).not.toContain(
			"require is not defined in ES module scope",
		);
		expect(result.status, result.stderr).toBe(0);
	});

	it("keeps iPhone and iPad layouts in full-screen portrait", () => {
		expect(APP_CONFIG_PATH).toBeDefined();

		const previousAppVariant = process.env.APP_VARIANT;
		process.env.APP_VARIANT = "development";

		let appConfig: ExpoConfig;
		try {
			const appConfigPath = require.resolve(APP_CONFIG_PATH ?? "");
			delete require.cache[appConfigPath];
			appConfig = require(appConfigPath) as ExpoConfig;
		} finally {
			if (previousAppVariant === undefined) {
				delete process.env.APP_VARIANT;
			} else {
				process.env.APP_VARIANT = previousAppVariant;
			}
		}

		expect(appConfig.orientation).toBe("portrait");
		expect(appConfig.ios?.supportsTablet).toBe(true);
		expect(appConfig.ios?.requireFullScreen).toBe(true);
	});
});
