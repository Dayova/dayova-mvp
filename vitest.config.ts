import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"#convex": fileURLToPath(new URL("./convex", import.meta.url)),
			"~": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		environment: "edge-runtime",
		globals: true,
		include: [
			"convex/**/*.test.ts",
			"src/**/*.test.ts",
			"eslint/**/*.test.ts",
		],
	},
});
