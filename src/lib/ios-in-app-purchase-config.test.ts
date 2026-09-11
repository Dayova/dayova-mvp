import { createRequire } from "node:module";
import type { ExpoConfig } from "expo/config";
import { describe, expect, test, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
	enableIosInAppPurchase,
	IN_APP_PURCHASE_CAPABILITY,
	STORE_KIT_FRAMEWORK,
} = require("../../plugins/withIosInAppPurchase.js") as {
	enableIosInAppPurchase: (project: MockXcodeProject) => MockXcodeProject;
	IN_APP_PURCHASE_CAPABILITY: string;
	STORE_KIT_FRAMEWORK: string;
};

type MockXcodeProject = ReturnType<typeof createMockProject>;

function createMockProject() {
	const targetId = "DAYOVA_TARGET";
	const targetAttributes: Record<string, Record<string, unknown>> = {
		[targetId]: {},
	};
	return {
		targetId,
		targetAttributes,
		addFramework: vi.fn(),
		getFirstProject: () => ({
			firstProject: { attributes: { TargetAttributes: targetAttributes } },
		}),
		getFirstTarget: () => ({ uuid: targetId }),
		hasFile: vi.fn(() => false),
	};
}

describe("iOS In-App Purchase configuration", () => {
	test("enables the capability and links StoreKit", () => {
		const project = createMockProject();

		enableIosInAppPurchase(project);

		expect(
			project.targetAttributes[project.targetId]?.SystemCapabilities,
		).toEqual({
			[IN_APP_PURCHASE_CAPABILITY]: { enabled: 1 },
		});
		expect(project.addFramework).toHaveBeenCalledWith(STORE_KIT_FRAMEWORK, {
			target: project.targetId,
		});
	});

	test("does not add StoreKit twice", () => {
		const project = createMockProject();
		project.hasFile.mockReturnValue(true);

		enableIosInAppPurchase(project);

		expect(project.addFramework).not.toHaveBeenCalled();
	});

	test("registers the capability plugin in the Expo config", () => {
		const previousAppVariant = process.env.APP_VARIANT;
		process.env.APP_VARIANT = "development";

		let appConfig: ExpoConfig;
		try {
			const appConfigPath = require.resolve("../../app.config.cts");
			delete require.cache[appConfigPath];
			appConfig = require(appConfigPath) as ExpoConfig;
		} finally {
			if (previousAppVariant === undefined) {
				delete process.env.APP_VARIANT;
			} else {
				process.env.APP_VARIANT = previousAppVariant;
			}
		}

		const pluginNames = (appConfig.plugins ?? []).map((plugin) =>
			Array.isArray(plugin) ? plugin[0] : plugin,
		);
		expect(pluginNames).toContain("./plugins/withIosInAppPurchase");
	});
});
