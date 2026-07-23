import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
	resolve: {
		alias: {
			"~": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		environment: "edge-runtime",
		include: ["convex/**/*.test.ts", "src/**/*.test.ts", "tests/**/*.test.ts"],
	},
});
