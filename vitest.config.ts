import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const testIncludes = [
	"convex/**/*.test.ts",
	"src/**/*.test.ts",
	"eslint/**/*.test.ts",
	"tests/**/*.test.ts",
];

const expoConfigContractTests = [
	"tests/ios-auth-capabilities.test.ts",
	"tests/ios-apple-sign-in-capability.test.ts",
	"tests/ios-privacy-config.test.ts",
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
					environment: "node",
					globalSetup: ["./tests/helpers/expo-config-global-setup.ts"],
					globals: true,
					include: expoConfigContractTests,
				},
			},
		],
	},
});
