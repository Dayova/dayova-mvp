import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

const packageJson = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as {
	packageManager: string;
};

const easConfig = JSON.parse(
	readFileSync(new URL("../eas.json", import.meta.url), "utf8"),
) as {
	build: {
		base: {
			pnpm: string;
		};
	};
};

const ciWorkflow = parseYaml(
	readFileSync(new URL("../.eas/workflows/ci.yml", import.meta.url), "utf8"),
) as {
	defaults: {
		tools: {
			pnpm: string;
		};
	};
};

const androidPlayWorkflow = parseYaml(
	readFileSync(
		new URL("../.eas/workflows/android-play-test.yml", import.meta.url),
		"utf8",
	),
) as {
	defaults: {
		tools: {
			pnpm: string;
		};
	};
};

describe("pnpm toolchain", () => {
	it("keeps independently maintained build and CI toolchains on the package's pinned version", () => {
		expect(packageJson.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
		const version = packageJson.packageManager.slice("pnpm@".length);
		expect(easConfig.build.base.pnpm).toBe(version);
		expect(ciWorkflow.defaults.tools.pnpm).toBe(version);
		expect(androidPlayWorkflow.defaults.tools.pnpm).toBe(version);
	});
});
