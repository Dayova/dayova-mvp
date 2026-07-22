import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as {
	scripts: Record<string, string>;
};

const developmentExpoScripts = ["expo:start", "expo:android", "expo:ios"];
const posixOnlyEnvironmentAssignment =
	/(?:^|(?:&&|\|\||;)\s*)[A-Za-z_][A-Za-z0-9_]*=[^\s;&|]*(?=\s|&&|\|\||;|$)/;

// Package scripts use simple shell command lines. Mask quoted arguments before
// checking command boundaries so examples or messages containing shell-like
// text are not mistaken for executable environment assignments.
const maskQuotedArguments = (command: string) => {
	let quote: "'" | '"' | null = null;
	let escaped = false;

	return [...command]
		.map((character) => {
			if (quote) {
				if (quote === '"' && character === "\\" && !escaped) {
					escaped = true;
					return " ";
				}

				if (character === quote && !escaped) {
					quote = null;
				}
				escaped = false;
				return " ";
			}

			if (character === "'" || character === '"') {
				quote = character;
				return " ";
			}

			return character;
		})
		.join("");
};

const findPosixOnlyScripts = (scripts: Record<string, string>) =>
	Object.entries(scripts)
		.filter(([, command]) =>
			posixOnlyEnvironmentAssignment.test(maskQuotedArguments(command)),
		)
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

	it("checks the generated Android autolinking cache before native builds", () => {
		expect(packageJson.scripts["preexpo:android"]).toBe(
			"node scripts/prepare-android-autolinking-cache.cjs",
		);
	});

	it("does not use POSIX-only inline environment assignments", () => {
		expect(findPosixOnlyScripts(packageJson.scripts)).toEqual([]);
	});

	it("detects POSIX-only assignments after shell operators", () => {
		expect(
			findPosixOnlyScripts({
				empty: "APP_VARIANT= expo export",
				and: "pnpm check && APP_VARIANT=production expo export",
				andEmpty: "pnpm check && APP_VARIANT= expo export",
				andWithoutSpaces: "APP_VARIANT=production&&expo export",
				or: "pnpm check || APP_VARIANT=development expo start",
				orWithoutSpaces: "APP_VARIANT=development||expo start",
				semicolon: "pnpm check; APP_VARIANT=preview expo config",
				semicolonWithoutSpaces: "APP_VARIANT=preview;expo config",
			}),
		).toEqual([
			"empty",
			"and",
			"andEmpty",
			"andWithoutSpaces",
			"or",
			"orWithoutSpaces",
			"semicolon",
			"semicolonWithoutSpaces",
		]);
	});

	it("ignores assignment-like text inside quoted arguments", () => {
		expect(
			findPosixOnlyScripts({
				singleQuoted: "echo '|| APP_VARIANT=production'",
				doubleQuoted: 'echo "&& APP_VARIANT=production"',
				escapedDoubleQuote: 'echo "\\"; APP_VARIANT=production"',
				realAssignmentAfterQuote:
					"echo '|| APP_VARIANT=preview' && APP_VARIANT=production expo export",
			}),
		).toEqual(["realAssignmentAfterQuote"]);
	});
});
