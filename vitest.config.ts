import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const testIncludes = [
	"convex/**/*.test.ts",
	"src/**/*.test.ts",
	"eslint/**/*.test.ts",
	"tests/**/*.test.ts",
];

const expoConfigContractTests = [
	"tests/ios-apple-sign-in-capability.test.ts",
	"tests/ota-safety.test.ts",
];

export default defineConfig({
	resolve: {
		alias: {
			"#convex": fileURLToPath(new URL("./convex", import.meta.url)),
			"~": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts", "convex/**/*.ts"],
			exclude: ["**/*.test.ts", "**/*.types.ts", "convex/_generated/**"],
			reporter: ["text-summary", "json-summary", "lcov", "html"],
			reportsDirectory: ".maestro/artifacts/ci/coverage/vitest",
		},
		// Several suites spawn Expo/Node processes. Keep them from exhausting the
		// worker's CPU and memory when the whole repository runs in CI.
		maxWorkers: 2,
		watchTriggerPatterns: [
			{
				pattern: /\/(?:app\.config\.cts|metro\.config\.js)$/,
				testsToRun: () => expoConfigContractTests,
			},
		],
		projects: [
			{
				resolve: {
					alias: {
						"#convex": fileURLToPath(new URL("./convex", import.meta.url)),
						"~": fileURLToPath(new URL("./src", import.meta.url)),
					},
				},
				test: {
					name: "unit",
					testTimeout: 30_000,
					environment: "edge-runtime",
					globals: true,
					include: testIncludes,
					exclude: expoConfigContractTests,
				},
			},
			{
				resolve: {
					alias: {
						"#convex": fileURLToPath(new URL("./convex", import.meta.url)),
						"~": fileURLToPath(new URL("./src", import.meta.url)),
					},
				},
				test: {
					name: "expo-config-contract",
					testTimeout: 30_000,
					environment: "node",
					globalSetup: ["./tests/helpers/expo-config-global-setup.ts"],
					globals: true,
					include: expoConfigContractTests,
				},
			},
		],
	},
});
