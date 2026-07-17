// @vitest-environment node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workspaceRoot = new URL("../", import.meta.url);

type SkillLock = {
	skills: Record<
		string,
		{
			source: string;
			sourceType: string;
			skillPath: string;
			computedHash: string;
		}
	>;
};

function readExpoSkill(...pathSegments: string[]) {
	return readFileSync(
		new URL(`.agents/skills/${pathSegments.join("/")}`, workspaceRoot),
		"utf8",
	);
}

function readSkillLock() {
	return JSON.parse(
		readFileSync(new URL("skills-lock.json", workspaceRoot), "utf8"),
	) as SkillLock;
}

describe("Expo skill compatibility guidance", () => {
	it("keeps the locked Expo catalog current and structurally valid", () => {
		const skillLock = readSkillLock();
		const expoSkills = Object.entries(skillLock.skills)
			.filter(([, entry]) => entry.source === "expo/skills")
			.sort(([left], [right]) => left.localeCompare(right));
		const expoSkillNames = expoSkills.map(([name]) => name);

		expect(expoSkillNames.length).toBeGreaterThan(0);
		expect(new Set(expoSkillNames).size).toBe(expoSkillNames.length);
		for (const [retiredName, replacementName] of [
			["building-native-ui", "expo-native-ui"],
			["expo-cicd-workflows", "eas-workflows"],
			["expo-ui-jetpack-compose", "expo-ui"],
			["expo-ui-swift-ui", "expo-ui"],
			["native-data-fetching", "expo-data-fetching"],
			["upgrading-expo", "expo-upgrade"],
			["use-dom", "expo-dom"],
		] as const) {
			expect(expoSkillNames).not.toContain(retiredName);
			expect(expoSkillNames).toContain(replacementName);
		}

		for (const [skillName, lockEntry] of expoSkills) {
			expect(lockEntry.sourceType).toBe("github");
			expect(lockEntry.computedHash).toMatch(/^[a-f0-9]{64}$/);
			expect(lockEntry.skillPath.replaceAll("\\", "/")).toMatch(
				new RegExp(`(?:^|/)${skillName}/SKILL\\.md$`),
			);
			expect(
				existsSync(
					new URL(`.agents/skills/${skillName}/SKILL.md`, workspaceRoot),
				),
				`${skillName} folder is missing`,
			).toBe(true);
		}
	});

	it("composes local corrections into one Expo skill at build time", () => {
		const packageJson = JSON.parse(
			readFileSync(new URL("package.json", workspaceRoot), "utf8"),
		) as { scripts?: Record<string, string> };
		const patchUrl = new URL(
			"patches/expo-skills/dayova.patch",
			workspaceRoot,
		);
		const overridesUrl = new URL(
			"patches/expo-skills/overrides.json",
			workspaceRoot,
		);
		const updaterUrl = new URL(
			"scripts/update-expo-skills.mjs",
			workspaceRoot,
		);
		const maintenanceUrl = new URL(
			"docs/agents/expo-skills.md",
			workspaceRoot,
		);

		expect(packageJson.scripts?.["skills:update:expo"]).toBe(
			"node scripts/update-expo-skills.mjs",
		);
		expect(existsSync(updaterUrl)).toBe(true);
		expect(existsSync(maintenanceUrl)).toBe(true);
		expect(existsSync(patchUrl)).toBe(true);
		expect(existsSync(overridesUrl)).toBe(true);
		const validation = spawnSync(
			process.execPath,
			[fileURLToPath(updaterUrl), "--validate-current"],
			{
				cwd: fileURLToPath(workspaceRoot),
				encoding: "utf8",
			},
		);
		expect(validation.stderr).toBe("");
		expect(validation.status).toBe(0);
		expect(validation.stdout).toMatch(
			/^Validated \d+ installed Expo skills\.\r?\n$/,
		);

		const localPatch = readFileSync(patchUrl, "utf8");
		const patchTargets = Array.from(
			localPatch.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm),
			([, source, target]) => ({ source, target }),
		);

		expect(patchTargets).toEqual([
			{
				source: ".agents/skills/expo-native-ui/SKILL.md",
				target: ".agents/skills/expo-native-ui/SKILL.md",
			},
			{
				source: ".agents/skills/expo-native-ui/references/animations.md",
				target: ".agents/skills/expo-native-ui/references/animations.md",
			},
			{
				source: ".agents/skills/expo-native-ui/references/storage.md",
				target: ".agents/skills/expo-native-ui/references/storage.md",
			},
		]);

		const overrideManifest = JSON.parse(
			readFileSync(overridesUrl, "utf8"),
		) as {
			overrides: Array<{
				target: string;
				source: string;
				upstreamSha256: string;
			}>;
		};
		expect(overrideManifest.overrides).toEqual([
			{
				target: ".agents/skills/expo-native-ui/references/controls.md",
				source: "files/expo-native-ui/references/controls.md",
				upstreamSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
			},
		]);
		const [controlsOverride] = overrideManifest.overrides;
		expect(controlsOverride).toBeDefined();
		if (!controlsOverride) return;
		expect(
			readFileSync(
				new URL(
					`patches/expo-skills/${controlsOverride.source}`,
					workspaceRoot,
				),
				"utf8",
			).replaceAll("\r\n", "\n"),
		).toBe(
			readExpoSkill(
				"expo-native-ui",
				"references",
				"controls.md",
			).replaceAll("\r\n", "\n"),
		);
	});

	it("chooses animation primitives by behavior instead of mandating Reanimated", () => {
		const animations = readExpoSkill(
			"expo-native-ui",
			"references",
			"animations.md",
		);

		expect(animations).not.toContain(
			"Use Reanimated v4. Avoid React Native's built-in Animated API.",
		);
		expect(animations).toContain("| Scenario | Prefer |");
		expect(animations).toContain("react-native-ease");
		expect(animations).toContain("release build");
		expect(animations).toContain("reduced-motion");
	});

	it("routes native controls through Expo UI and Dayova's shared wrapper", () => {
		const skill = readExpoSkill("expo-native-ui", "SKILL.md");
		const controls = readExpoSkill(
			"expo-native-ui",
			"references",
			"controls.md",
		);
		const storage = readExpoSkill(
			"expo-native-ui",
			"references",
			"storage.md",
		);
		const nativeControlGuidance = `${skill}\n${controls}\n${storage}`;

		expect(nativeControlGuidance).not.toContain(
			"@react-native-community/datetimepicker",
		);
		expect(controls).not.toContain(
			"@react-native-segmented-control/segmented-control",
		);
		expect(controls).not.toContain("@react-native-community/slider");
		expect(controls).not.toContain("@react-native-picker/picker");
		expect(controls).not.toMatch(
			/import\s+\{[^}]*\bStepper\b[^}]*\}\s+from\s+["']react-native["']/,
		);
		expect(nativeControlGuidance).not.toMatch(
			/import\s+\{[^}]*\bSwitch\b[^}]*\}\s+from\s+["']react-native["']/,
		);
		expect(skill).toContain("$expo-ui");
		expect(skill).toContain("NativeWind semantic tokens");
		expect(skill).not.toContain("CSS and Tailwind are not supported");
		expect(skill).not.toContain("Centralize the palette in `theme/colors.ts`");
		expect(controls).toContain("@expo/ui/community/datetime-picker");
		expect(controls).toContain(
			'from "~/components/ui/date-time-picker-sheet"',
		);
		expect(storage).toContain('from "~/components/ui/switch"');
	});
});
