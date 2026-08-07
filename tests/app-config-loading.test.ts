import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

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

	it(
		"disables the Expo Dev Menu floating tools button",
		() => {
			const result = spawnSync(
				resolve(process.cwd(), "node_modules/.bin/expo"),
				["config", "--type", "introspect", "--json"],
				{
					cwd: process.cwd(),
					encoding: "utf8",
					env: {
						...process.env,
						APP_VARIANT: "development",
					},
				},
			);

			expect(result.status, result.stderr).toBe(0);
			const config = JSON.parse(result.stdout);
			expect(config.ios.infoPlist.EXDevMenuShowFloatingActionButton).toBe(false);

			const androidMetadata =
				config._internal.modResults.android.manifest.manifest.application[0][
					"meta-data"
				];
			expect(androidMetadata).toContainEqual({
				$: {
					"android:name": "EXDevMenuShowFloatingActionButton",
					"android:value": "false",
				},
			});
		},
		15_000,
	);
});
