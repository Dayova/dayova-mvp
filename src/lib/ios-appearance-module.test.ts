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
const IOS_TYPESCRIPT_MODULE_PATH = resolve(
	process.cwd(),
	"modules/dayova-system-appearance/src/DayovaSystemAppearanceModule.ts",
);
const IOS_SYSTEM_COLOR_SCHEME_PATH = resolve(
	process.cwd(),
	"src/lib/system-color-scheme.ios.ts",
);
const EXPO_UPDATES_PATCH_PATH = resolve(
	process.cwd(),
	"patches/expo-updates@57.0.9.patch",
);
const PNPM_WORKSPACE_PATH = resolve(process.cwd(), "pnpm-workspace.yaml");

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

		expect(appActiveHandler).toContain("Self.notifyReactNativeAppearance()");
		expect(appActiveHandler).toContain("refreshAppearanceObservation()");
		expect(
			appActiveHandler.indexOf("Self.notifyReactNativeAppearance()"),
		).toBeLessThan(appActiveHandler.indexOf("refreshAppearanceObservation()"));

		const refreshHandler = balancedBlock(
			module,
			"private func refreshAppearanceObservation()",
		);
		expect(refreshHandler).toContain("guard isObserving else { return }");
		expect(refreshHandler).toContain("installObserver()");
	});

	test("destroys UIKit observers and views entirely on the main queue", () => {
		const module = readFileSync(IOS_MODULE_PATH, "utf8");
		const destroyHandler = balancedBlock(module, "OnDestroy");
		const cleanup = balancedBlock(destroyHandler, "DispatchQueue.main.async");

		expect(cleanup).toContain("self.isObserving = false");
		expect(cleanup).toContain("self.observerView?.removeFromSuperview()");
		expect(cleanup).toContain("self.snapshotShieldView?.removeFromSuperview()");
		expect(cleanup).toContain("NotificationCenter.default.removeObserver");
	});

	test("covers stale app snapshots until the resumed theme has committed", () => {
		const module = readFileSync(IOS_MODULE_PATH, "utf8");
		const typedModule = readFileSync(IOS_TYPESCRIPT_MODULE_PATH, "utf8");
		const systemColorScheme = readFileSync(
			IOS_SYSTEM_COLOR_SCHEME_PATH,
			"utf8",
		);

		const createHandler = balancedBlock(module, "OnCreate");
		expect(createHandler).toContain("startSnapshotShieldObservation()");
		expect(module).toContain("UIApplication.willResignActiveNotification");
		expect(module).toContain("showSnapshotShield()");
		expect(module).toContain("snapshotShieldGeneration += 1");
		expect(module).toContain("shield.isUserInteractionEnabled = false");
		expect(module).toContain("shield.isAccessibilityElement = false");
		expect(module).toContain("shield.accessibilityElementsHidden = true");
		expect(module).toContain("shield.accessibilityViewIsModal = true");
		expect(module).toContain('Function("releaseSnapshotShield")');
		expect(module).toContain("generation == snapshotShieldGeneration");

		const appActiveHandler = balancedBlock(module, "OnAppBecomesActive");
		expect(appActiveHandler).toContain("refreshAppearanceObservation()");
		expect(appActiveHandler).toContain('sendEvent("onResume",');
		expect(
			appActiveHandler.indexOf("refreshAppearanceObservation()"),
		).toBeLessThan(appActiveHandler.indexOf('sendEvent("onResume",'));

		expect(typedModule).toContain(
			"releaseSnapshotShield(generation: number): void;",
		);
		expect(systemColorScheme).toMatch(
			/DayovaSystemAppearance\.addListener\(\s*"onResume"/,
		);
		expect(systemColorScheme).toContain(
			"DayovaSystemAppearance.releaseSnapshotShield(snapshotShieldGeneration)",
		);
	});

	test("keeps Expo Updates' deferred splash in the active iOS appearance", () => {
		const patch = readFileSync(EXPO_UPDATES_PATCH_PATH, "utf8");
		const pnpmWorkspace = readFileSync(PNPM_WORKSPACE_PATH, "utf8");

		expect(pnpmWorkspace).toContain(
			"expo-updates@57.0.9: patches/expo-updates@57.0.9.patch",
		);
		expect(patch).toContain("let traitCollection = getWindow().traitCollection");
		expect(patch).toContain(
			"view.overrideUserInterfaceStyle = traitCollection.userInterfaceStyle",
		);
		expect(patch).toContain(
			"rootView.overrideUserInterfaceStyle = traitCollection.userInterfaceStyle",
		);
		expect(patch).toContain(
			".resolvedColor(with: traitCollection)",
		);
	});
});
