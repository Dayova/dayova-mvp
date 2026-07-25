import path from "node:path";
import { fileURLToPath } from "node:url";
import convexPlugin from "@convex-dev/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { dayovaUiPlugin } from "./eslint/dayova-ui-plugin.mjs";

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

const reactCompilerRules = Object.fromEntries(
  Object.keys(reactHooks.configs.flat["recommended-latest"].rules).map(
    (ruleName) => [ruleName, "error"],
  ),
);

export default tseslint.config(
  {
    ignores: [
      ".expo/**",
      "android/**",
      "assets/**",
      "convex/_generated/**",
      "node_modules/**",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}", "index.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
		plugins: {
			"dayova-ui": dayovaUiPlugin,
			"react-hooks": reactHooks,
		},
		rules: {
			...reactCompilerRules,
			"dayova-ui/no-direct-native-controls": "error",
			"dayova-ui/no-direct-overlay-primitives": "error",
			"dayova-ui/require-compose-host-theme": "error",
		},
  },
	{
		files: ["src/**/*.{test,spec}.{ts,tsx}"],
		ignores: [
			"src/components/onboarding/intro-tasks-artwork-assets.test.ts",
			"src/components/onboarding/intro-upload-artwork.test.ts",
			"src/lib/ios-appearance-module.test.ts",
			"src/lib/theme-css.test.ts",
		],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: [
						{
							name: "fs",
							message:
								"Render runtime behavior or enforce architecture with ESLint instead of scanning component source text.",
						},
						{
							name: "fs/promises",
							message:
								"Render runtime behavior or enforce architecture with ESLint instead of scanning component source text.",
						},
						{
							name: "node:fs",
							message:
								"Render runtime behavior or enforce architecture with ESLint instead of scanning component source text.",
						},
						{
							name: "node:fs/promises",
							message:
								"Render runtime behavior or enforce architecture with ESLint instead of scanning component source text.",
						},
					],
				},
			],
		},
	},
  {
    files: ["convex/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
    plugins: {
      "@convex-dev": convexPlugin,
    },
    rules: {
      "@convex-dev/no-old-registered-function-syntax": "error",
      "@convex-dev/require-args-validator": "error",
      "@convex-dev/explicit-table-ids": "error",
      "@convex-dev/no-filter-in-query": "error",
      "@convex-dev/no-collect-in-query": "error",
      "@convex-dev/import-wrong-runtime": "off",
    },
  },
);
