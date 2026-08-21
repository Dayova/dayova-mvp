import { createRequire } from "node:module";
import type { ExpoConfig } from "expo/config";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const { applyAndroidGradleJvmMemory, DAYOVA_GRADLE_JVM_ARGS } =
	require("../../plugins/withAndroidGradleJvmMemory.js") as {
		applyAndroidGradleJvmMemory: (
			properties: GradleProperty[],
		) => GradleProperty[];
		DAYOVA_GRADLE_JVM_ARGS: string;
	};

type GradleProperty = {
	type: "property";
	key: string;
	value: string;
};

describe("Android Gradle build configuration", () => {
	test("replaces the generated JVM limit with Dayova's measured build ceiling", () => {
		const properties: GradleProperty[] = [
			{
				type: "property",
				key: "org.gradle.jvmargs",
				value: "-Xmx2048m -XX:MaxMetaspaceSize=512m",
			},
		];

		expect(applyAndroidGradleJvmMemory(properties)).toEqual([
			{
				type: "property",
				key: "org.gradle.jvmargs",
				value: DAYOVA_GRADLE_JVM_ARGS,
			},
		]);
	});

	test("adds the JVM limit once when Expo did not generate one", () => {
		const properties: GradleProperty[] = [];

		applyAndroidGradleJvmMemory(properties);
		applyAndroidGradleJvmMemory(properties);

		expect(properties).toEqual([
			{
				type: "property",
				key: "org.gradle.jvmargs",
				value: DAYOVA_GRADLE_JVM_ARGS,
			},
		]);
	});

	test("registers the Android Gradle plugins in the Expo config", () => {
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

		expect(pluginNames).toContain("./plugins/withAndroidGradleJvmMemory");
		expect(pluginNames).toContain("./plugins/withAndroidGradleDaemonJvm");
	});
});
