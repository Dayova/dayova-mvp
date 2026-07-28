import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));

describe("intro tasks artwork assets", () => {
	test("does not retain the superseded SVG or custom fire icon", () => {
		expect(
			existsSync(
				resolve(testDirectory, "../../../assets/onboarding/intro-tasks.svg"),
			),
		).toBe(false);
		expect(
			existsSync(
				resolve(testDirectory, "../../../assets/onboarding/streak-fire.svg"),
			),
		).toBe(false);
	});
});
