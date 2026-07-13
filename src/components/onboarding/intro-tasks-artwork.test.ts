import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const artworkSource = () =>
	readFileSync(resolve(testDirectory, "intro-tasks-artwork.tsx"), "utf8");
const authFlowSource = readFileSync(
	resolve(testDirectory, "../../features/auth/dayova-auth-flow.tsx"),
	"utf8",
);
const legacyArtworkPath = resolve(
	testDirectory,
	"../../../assets/onboarding/intro-tasks.svg",
);

describe("intro tasks artwork", () => {
	test("uses the maintainable artwork in the production onboarding flow", () => {
		expect(authFlowSource).toContain(
			'import { IntroTasksArtwork } from "~/components/onboarding/intro-tasks-artwork";',
		);
		expect(authFlowSource).not.toContain(
			'import IntroTasksSvg from "../../../assets/onboarding/intro-tasks.svg";',
		);
	});

	test("matches the descriptive Figma task examples", () => {
		const source = artworkSource();

		expect(source).toContain('label: "Hausaufgabe Mathe"');
		expect(source).toContain('label: "Deutsch Vortrag"');
		expect(source).toContain('label: "Geschichte Test lernen"');
	});

	test("renders the transparent Dayova mark instead of an embedded JPEG", () => {
		const source = artworkSource();

		expect(source).toContain(
			'require("../../../assets/onboarding/dayova-y.png")',
		);
		expect(source).not.toMatch(/\.jpe?g|data:image\/jpeg/i);
	});

	test("removes the superseded broken SVG export", () => {
		expect(existsSync(legacyArtworkPath)).toBe(false);
	});

	test("uses the supplied Figma fire icon", () => {
		const source = artworkSource();

		expect(source).toContain(
			'import StreakFireSvg from "../../../assets/onboarding/streak-fire.svg";',
		);
		expect(source).toContain("<StreakFireSvg />");
		expect(source).not.toContain("Flame");
	});
});
