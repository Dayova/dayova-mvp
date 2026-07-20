import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as {
	scripts: Record<string, string>;
};

const developmentExpoScripts = ["expo:start", "expo:android", "expo:ios"];
const posixOnlyEnvironmentAssignment =
	/(?:^|(?:&&|\|\||;)\s*)[A-Za-z_][A-Za-z0-9_]*=[^\s;]+(?:\s|$)/;

const findPosixOnlyScripts = (scripts: Record<string, string>) =>
	Object.entries(scripts)
		.filter(([, command]) => posixOnlyEnvironmentAssignment.test(command))
		.map(([name]) => name);

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
		expect(findPosixOnlyScripts(packageJson.scripts)).toEqual([]);
	});

	it("detects POSIX-only assignments after shell operators", () => {
		expect(
			findPosixOnlyScripts({
				and: "pnpm check && APP_VARIANT=production expo export",
				or: "pnpm check || APP_VARIANT=development expo start",
				semicolon: "pnpm check; APP_VARIANT=preview expo config",
			}),
		).toEqual(["and", "or", "semicolon"]);
	});
});
