import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as {
	scripts: Record<string, string>;
};

const developmentExpoScripts = ["expo:start", "expo:android", "expo:ios"];

describe("package scripts", () => {
	it.each(developmentExpoScripts)(
		"sets APP_VARIANT portably for %s",
		(scriptName) => {
			expect(packageJson.scripts[scriptName]).toMatch(
				/^cross-env APP_VARIANT=development expo /,
			);
		},
	);

	it("sets APP_VARIANT portably for unused-code analysis", () => {
		expect(packageJson.scripts["check:unused"]).toBe(
			"cross-env APP_VARIANT=development knip",
		);
	});

	it("does not use POSIX-only inline environment assignments", () => {
		const posixOnlyScripts = Object.entries(packageJson.scripts)
			.filter(([, command]) => /^[A-Za-z_][A-Za-z0-9_]*=[^ ]+ /.test(command))
			.map(([name]) => name);

		expect(posixOnlyScripts).toEqual([]);
	});
});
