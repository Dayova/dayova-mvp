// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workspaceRoot = new URL("../", import.meta.url);
const expectedExpoSkills = [
	"eas-app-stores",
	"eas-hosting",
	"eas-observe",
	"eas-simulator",
	"eas-update-insights",
	"eas-workflows",
	"expo-app-clip",
	"expo-brownfield",
	"expo-data-fetching",
	"expo-dev-client",
	"expo-dom",
	"expo-examples",
	"expo-module",
	"expo-native-ui",
	"expo-project-structure",
	"expo-router",
	"expo-skill-eval",
	"expo-skill-feedback",
	"expo-tailwind-setup",
	"expo-ui",
	"expo-upgrade",
	"expo-web-to-native",
];

type SkillLock = {
	skills: Record<string, { source: string; skillPath: string }>;
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
		const expoSkillNames = Object.entries(skillLock.skills)
			.filter(([, entry]) => entry.source === "expo/skills")
			.map(([name]) => name)
			.sort();

		expect(expoSkillNames).toEqual(expectedExpoSkills);

		for (const skillName of expoSkillNames) {
			const skillUrl = new URL(
				`.agents/skills/${skillName}/SKILL.md`,
				workspaceRoot,
			);
			expect(existsSync(skillUrl), `${skillName} folder is missing`).toBe(true);

			const content = readFileSync(skillUrl, "utf8");
			const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
			expect(frontmatter, `${skillName} frontmatter is missing`).toBeDefined();
			expect(frontmatter).toMatch(
				new RegExp(`^name:\\s*["']?${skillName}["']?\\s*$`, "m"),
			);
			expect(frontmatter).toMatch(/^description:/m);
			expect(frontmatter).not.toMatch(/^version:/m);

			for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
				const target = match[1]?.replace(/^<|>$/g, "").split("#", 1)[0];
				if (!target || /^(?:https?:|mailto:)/.test(target)) continue;

				const resourceUrl = new URL(target, skillUrl);
				expect(
					existsSync(resourceUrl),
					`${skillName} links to missing resource ${target}`,
				).toBe(true);
			}
		}
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
