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

function balancedBlock(source: string, marker: string) {
	const markerIndex = source.indexOf(marker);
	const openingBrace = source.indexOf("{", markerIndex + marker.length);

	expect(markerIndex).toBeGreaterThanOrEqual(0);
	expect(openingBrace).toBeGreaterThan(markerIndex);

	let depth = 0;
	for (let index = openingBrace; index < source.length; index += 1) {
		if (source[index] === "{") depth += 1;
		if (source[index] === "}") depth -= 1;

		if (depth === 0) return source.slice(openingBrace + 1, index);
	}

	throw new Error(`Unbalanced Swift block after: ${marker}`);
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
		const availabilityBlock = balancedBlock(
			initializer,
			"if #available(iOS 17.0, *)",
		);

		expect(availabilityBlock).toContain("registerForTraitChanges");
		expect(availabilityBlock).toContain(
			"view.emitColorSchemeIfChanged(from: previousTraitCollection)",
		);
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

	test("retries a missing appearance observer when the app becomes active", () => {
		const module = readFileSync(IOS_MODULE_PATH, "utf8");
		const appActiveHandler = balancedBlock(module, "OnAppBecomesActive");

		expect(appActiveHandler).toContain("refreshAppearanceObservation()");

		const refreshHandler = balancedBlock(
			module,
			"private func refreshAppearanceObservation()",
		);
		expect(refreshHandler).toContain("guard isObserving else { return }");
		expect(refreshHandler).toContain("installObserver()");
	});
});
