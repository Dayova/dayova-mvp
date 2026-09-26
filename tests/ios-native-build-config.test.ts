import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const EXPO_DEV_LAUNCHER_PATCH_PATH = resolve(
	process.cwd(),
	"patches/expo-dev-launcher@57.0.19.patch",
);
const EXPO_MODULES_JSI_PATCH_PATH = resolve(
	process.cwd(),
	"patches/expo-modules-jsi@57.0.8.patch",
);
const PNPM_WORKSPACE_PATH = resolve(process.cwd(), "pnpm-workspace.yaml");
describe("iOS native build configuration", () => {
	it("keeps ExpoModulesJSI build products outside file-provider workspaces", () => {
		const patch = readFileSync(EXPO_MODULES_JSI_PATCH_PATH, "utf8");
		const pnpmWorkspace = readFileSync(PNPM_WORKSPACE_PATH, "utf8");

		expect(pnpmWorkspace).toContain(
			"expo-modules-jsi@57.0.8: patches/expo-modules-jsi@57.0.8.patch",
		);
		expect(patch).toContain("EXPO_MODULES_JSI_DERIVED_DATA_PATH");
		expect(patch).toContain("DERIVED_FILE_DIR");
		expect(patch).toContain("ExpoModulesJSI-SPM");
	});

	it("marks the dev-launcher plist cleanup phase as intentionally always run", () => {
		const patch = readFileSync(EXPO_DEV_LAUNCHER_PATCH_PATH, "utf8");
		const pnpmWorkspace = readFileSync(PNPM_WORKSPACE_PATH, "utf8");

		expect(pnpmWorkspace).toContain(
			"expo-dev-launcher@57.0.19: patches/expo-dev-launcher@57.0.19.patch",
		);
		expect(patch).toContain(
			"project.addBuildPhase([], 'PBXShellScriptBuildPhase'",
		);
		expect(patch).toContain(
			"addedPhase.buildPhase.alwaysOutOfDate = 1;",
		);
	});
});
