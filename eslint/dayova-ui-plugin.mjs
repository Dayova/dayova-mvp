const FRAME_PATH = "/src/components/ui/dayova-sheet-frame.tsx";
const ROOT_LAYOUT_PATH = "/src/app/_layout.tsx";

export const noDirectOverlayPrimitives = {
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
			nativeNamespace:
				"Do not namespace-import react-native because overlay primitives could bypass the Dayova sheet boundary. Use named imports.",
		},
		schema: [],
	},
	create(context) {
		const filename = context.filename.replaceAll("\\", "/");

		return {
			ImportDeclaration(node) {
				if (node.source.value === "@gorhom/bottom-sheet") {
					const isFrame = filename.endsWith(FRAME_PATH);
					const isProviderImport =
						filename.endsWith(ROOT_LAYOUT_PATH) &&
						node.specifiers.length > 0 &&
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
					if (specifier.type === "ImportNamespaceSpecifier") {
						context.report({
							node: specifier,
							messageId: "nativeNamespace",
						});
						continue;
					}
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
};

export const dayovaUiPlugin = {
	rules: {
		"no-direct-overlay-primitives": noDirectOverlayPrimitives,
	},
};
