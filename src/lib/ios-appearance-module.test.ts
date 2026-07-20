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

function sectionBetween(
	source: string,
	startMarker: string,
	endMarker: string,
) {
	const startIndex = source.indexOf(startMarker);
	const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);

	expect(startIndex).toBeGreaterThanOrEqual(0);
	expect(endIndex).toBeGreaterThan(startIndex);

	return source.slice(startIndex, endIndex);
}

describe("iOS system appearance module", () => {
	test("pins the module to Expo SDK 57's iOS 16.4 support floor", () => {
		const podspec = readFileSync(IOS_PODSPEC_PATH, "utf8");

		expect(podspec).toMatch(/s\.platforms\s*=\s*\{\s*:ios\s*=>\s*'16\.4'\s*\}/);
	});

	test("keeps the iOS 17 registration behind its availability marker", () => {
		const module = readFileSync(IOS_MODULE_PATH, "utf8");
		const initializer = sectionBetween(
			module,
			"override init(frame: CGRect)",
			"override func traitCollectionDidChange",
		);
		const availabilityCheck = initializer.indexOf("if #available(iOS 17.0, *)");
		const traitRegistration = initializer.indexOf("registerForTraitChanges");
		const sharedHandlerCall = initializer.indexOf(
			"view.emitColorSchemeIfChanged(from: previousTraitCollection)",
		);

		expect(availabilityCheck).toBeGreaterThanOrEqual(0);
		expect(traitRegistration).toBeGreaterThan(availabilityCheck);
		expect(sharedHandlerCall).toBeGreaterThan(traitRegistration);
	});

	test("keeps the pre-iOS 17 callback guard and shared-handler call in order", () => {
		const module = readFileSync(IOS_MODULE_PATH, "utf8");
		const legacyCallback = sectionBetween(
			module,
			"override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?)",
			"required init?(coder: NSCoder)",
		);
		const availabilityCheck = legacyCallback.indexOf(
			"if #available(iOS 17.0, *)",
		);
		const modernIosReturn = legacyCallback.indexOf("return", availabilityCheck);
		const sharedHandlerCall = legacyCallback.indexOf(
			"emitColorSchemeIfChanged(from: previousTraitCollection)",
		);

		expect(legacyCallback).toContain(
			"super.traitCollectionDidChange(previousTraitCollection)",
		);
		expect(availabilityCheck).toBeGreaterThanOrEqual(0);
		expect(modernIosReturn).toBeGreaterThan(availabilityCheck);
		expect(sharedHandlerCall).toBeGreaterThan(modernIosReturn);
	});
});
