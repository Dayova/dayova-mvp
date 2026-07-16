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

const dayovaUiPlugin = {
	rules: {
		"no-direct-overlay-primitives": {
			meta: {
				type: "problem",
				docs: {
					description:
						"Keep app-owned overlays on the shared Dayova sheet architecture.",
				},
				messages: {
					gorhom:
						"Import Gorhom primitives only in dayova-sheet-frame.tsx. Use DayovaSheetFrame or one of its specialized sheets instead.",
					native:
						"Do not use React Native {{name}} for app-owned UI. Use ConfirmationSheet, ActionSheet, DayovaSheetFrame, or inline feedback.",
				},
				schema: [],
			},
			create(context) {
				const filename = context.filename.replaceAll("\\", "/");

				return {
					ImportDeclaration(node) {
						if (node.source.value === "@gorhom/bottom-sheet") {
							const isFrame = filename.endsWith(
								"/src/components/ui/dayova-sheet-frame.tsx",
							);
							const isProviderImport =
								filename.endsWith("/src/app/_layout.tsx") &&
								node.specifiers.every(
									(specifier) =>
										specifier.type === "ImportSpecifier" &&
										specifier.imported.name === "BottomSheetModalProvider",
								);

							if (!isFrame && !isProviderImport) {
								context.report({ node, messageId: "gorhom" });
							}
							return;
						}

						if (node.source.value !== "react-native") return;

						for (const specifier of node.specifiers) {
							if (specifier.type !== "ImportSpecifier") continue;
							const importedName = specifier.imported.name;
							if (!["ActionSheetIOS", "Alert", "Modal"].includes(importedName)) {
								continue;
							}

							context.report({
								node: specifier,
								messageId: "native",
								data: { name: importedName },
							});
						}
					},
				};
			},
		},
	},
};

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
			"dayova-ui/no-direct-overlay-primitives": "error",
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
