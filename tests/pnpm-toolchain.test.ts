import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

const packageJson = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as {
	packageManager: string;
};

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

const easConfig = JSON.parse(
	readFileSync(new URL("../eas.json", import.meta.url), "utf8"),
) as {
	build: {
		base: {
			pnpm: string;
		};
	};
};

const workflow = parseYaml(
	readFileSync(new URL("../.eas/workflows/ci.yml", import.meta.url), "utf8"),
) as {
	defaults: {
		tools: {
			pnpm: string;
		};
	};
};

const workspace = parseYaml(
	readFileSync(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8"),
) as {
	autoInstallPeers?: boolean;
	allowBuilds?: Record<string, boolean>;
	onlyBuiltDependencies?: string[];
	packageManagerStrictVersion?: boolean;
	pmOnFail?: string;
};

function parseNpmrcSettingNames(content: string): Set<string> {
	const settingNames = new Set<string>();

	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (line === "" || line.startsWith("#") || line.startsWith(";")) {
			continue;
		}

		const separatorIndex = line.indexOf("=");
		const name = (
			separatorIndex === -1 ? line : line.slice(0, separatorIndex)
		)
			.trim()
			.replace(/\[\]$/, "")
			.replaceAll("-", "")
			.toLowerCase();

		settingNames.add(name);
	}

	return settingNames;
}

describe("pnpm toolchain", () => {
	it("pins and documents one exact pnpm 11 version across every toolchain surface", () => {
		expect(packageJson.packageManager).toMatch(/^pnpm@11\.\d+\.\d+$/);

		const pnpmVersion = packageJson.packageManager.slice("pnpm@".length);

		expect(easConfig.build.base.pnpm).toBe(pnpmVersion);
		expect(workflow.defaults.tools.pnpm).toBe(pnpmVersion);
		expect(readme).toContain(`- pnpm ${pnpmVersion}`);
	});

	it("keeps pnpm 11 workspace settings out of .npmrc and removes legacy build settings", () => {
		expect(workspace.autoInstallPeers).toBe(false);
		expect(workspace.pmOnFail).toBe("error");
		expect(workspace.allowBuilds).toEqual({
			"browser-tabs-lock": false,
			"core-js": false,
			esbuild: true,
			"tesseract.js": false,
		});
		expect(workspace).not.toHaveProperty("onlyBuiltDependencies");
		expect(workspace).not.toHaveProperty("packageManagerStrictVersion");

		const npmrcPath = new URL("../.npmrc", import.meta.url);
		const npmrcSettingNames = existsSync(npmrcPath)
			? parseNpmrcSettingNames(readFileSync(npmrcPath, "utf8"))
			: new Set<string>();

		expect(npmrcSettingNames).not.toContain("autoinstallpeers");
		expect(npmrcSettingNames).not.toContain("onlybuiltdependencies");
		expect(npmrcSettingNames).not.toContain("packagemanagerstrictversion");
		expect(npmrcSettingNames).not.toContain("pmonfail");
	});
});
