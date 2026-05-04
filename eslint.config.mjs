import path from "node:path";
import { fileURLToPath } from "node:url";
import convexPlugin from "@convex-dev/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

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
      "react-hooks": reactHooks,
    },
    rules: reactCompilerRules,
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
