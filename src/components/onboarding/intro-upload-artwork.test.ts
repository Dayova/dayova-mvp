import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const introUploadSvg = readFileSync(
	resolve(testDirectory, "../../../assets/onboarding/intro-upload.svg"),
	"utf8",
);

describe("intro upload artwork", () => {
	test("uses sentence case for the scan instruction", () => {
		expect(introUploadSvg).toContain("oder scanne deine Mitschriften");
		expect(introUploadSvg).not.toContain("oder Scanne deine Mitschriften");
	});
});
