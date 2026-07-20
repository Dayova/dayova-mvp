import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const IOS_MODULE_PATH = resolve(
	process.cwd(),
	"modules/dayova-system-appearance/ios/DayovaSystemAppearanceModule.swift",
);
const IOS_PODSPEC_PATH = resolve(
	process.cwd(),
	"modules/dayova-system-appearance/ios/DayovaSystemAppearance.podspec",
);

describe("iOS system appearance module", () => {
	test("does not raise Expo SDK 57's iOS 16.4 support floor", () => {
		const podspec = readFileSync(IOS_PODSPEC_PATH, "utf8");

		expect(podspec).toMatch(/s\.platforms\s*=\s*\{\s*:ios\s*=>\s*'16\.4'\s*\}/);
	});

	test("uses the iOS 17 trait API with an older-iOS fallback", () => {
		const module = readFileSync(IOS_MODULE_PATH, "utf8");
		const availabilityCheck = module.indexOf("if #available(iOS 17.0, *)");
		const traitRegistration = module.indexOf("registerForTraitChanges");

		expect(availabilityCheck).toBeGreaterThanOrEqual(0);
		expect(traitRegistration).toBeGreaterThan(availabilityCheck);
		expect(module).toContain(
			"override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?)",
		);
	});
});
