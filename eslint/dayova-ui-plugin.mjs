const FRAME_PATH = "/src/components/ui/dayova-sheet-frame.tsx";
const ROOT_LAYOUT_PATH = "/src/app/_layout.tsx";
const SWITCH_PATHS = [
	"/src/components/ui/switch.tsx",
	"/src/components/ui/switch.ios.tsx",
	"/src/components/ui/switch.android.tsx",
];
const DATE_TIME_PICKER_PATHS = [
	"/src/components/ui/date-time-picker-sheet.tsx",
	"/src/components/ui/date-time-picker-sheet.android.tsx",
];

const endsWithAny = (filename, paths) =>
	paths.some((path) => filename.endsWith(path));

function getNativeControlMessageId(moduleName, controlName, filename) {
	if (moduleName === "react-native" && controlName === "Switch") {
		return "switch";
	}
	if (
		(moduleName === "@expo/ui" ||
			moduleName === "@expo/ui/jetpack-compose") &&
		controlName === "Switch" &&
		!endsWithAny(filename, SWITCH_PATHS)
	) {
		return "switch";
	}
	if (
		moduleName === "@expo/ui/jetpack-compose" &&
		["DatePickerDialog", "TimePickerDialog"].includes(controlName) &&
		!endsWithAny(filename, DATE_TIME_PICKER_PATHS)
	) {
		return "dateTime";
	}
	if (
		(moduleName === "@expo/ui" ||
			moduleName === "@expo/ui/jetpack-compose") &&
		controlName === "Picker"
	) {
		return "picker";
	}
	return null;
}

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

export const noDirectNativeControls = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Keep platform-native controls behind Dayova design-system adapters.",
		},
		messages: {
			dateTime:
				"Import native date/time controls only in DateTimePickerSheet.",
			picker:
				"Do not use a platform picker directly. Use SelectSheet or a documented Dayova adapter.",
			switch: "Import Switch from ~/components/ui/switch.",
		},
		schema: [],
	},
	create(context) {
		const filename = context.filename.replaceAll("\\", "/");
		const namespaceImports = new Map();

		return {
			ImportDeclaration(node) {
				const moduleName = node.source.value;
				for (const specifier of node.specifiers) {
					if (
						specifier.type === "ImportNamespaceSpecifier" &&
						["react-native", "@expo/ui", "@expo/ui/jetpack-compose"].includes(
							moduleName,
						)
					) {
						namespaceImports.set(specifier.local.name, moduleName);
						continue;
					}
					if (specifier.type !== "ImportSpecifier") continue;
					const importedName = specifier.imported.name;
					const messageId = getNativeControlMessageId(
						moduleName,
						importedName,
						filename,
					);
					if (messageId) context.report({ node: specifier, messageId });
				}
			},
			JSXOpeningElement(node) {
				if (
					node.name.type !== "JSXMemberExpression" ||
					node.name.object.type !== "JSXIdentifier" ||
					node.name.property.type !== "JSXIdentifier"
				) {
					return;
				}
				const moduleName = namespaceImports.get(node.name.object.name);
				if (!moduleName) return;
				const messageId = getNativeControlMessageId(
					moduleName,
					node.name.property.name,
					filename,
				);
				if (messageId) context.report({ node: node.name, messageId });
			},
		};
	},
};

export const requireComposeHostTheme = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Require Dayova theme inputs on every Jetpack Compose Host.",
		},
		messages: {
			missingTheme:
				"Jetpack Compose Host must provide both seedColor and colorScheme so Material You cannot override Dayova branding.",
		},
		schema: [],
	},
	create(context) {
		const hostLocalNames = new Set();
		const namespaceLocalNames = new Set();

		return {
			ImportDeclaration(node) {
				if (node.source.value !== "@expo/ui/jetpack-compose") return;
				for (const specifier of node.specifiers) {
					if (
						specifier.type === "ImportSpecifier" &&
						specifier.imported.name === "Host"
					) {
						hostLocalNames.add(specifier.local.name);
					}
					if (specifier.type === "ImportNamespaceSpecifier") {
						namespaceLocalNames.add(specifier.local.name);
					}
				}
			},
			JSXOpeningElement(node) {
				const isDirectHost =
					node.name.type === "JSXIdentifier" &&
					hostLocalNames.has(node.name.name);
				const isNamespaceHost =
					node.name.type === "JSXMemberExpression" &&
					node.name.object.type === "JSXIdentifier" &&
					namespaceLocalNames.has(node.name.object.name) &&
					node.name.property.type === "JSXIdentifier" &&
					node.name.property.name === "Host";
				if (!isDirectHost && !isNamespaceHost) return;

				const attributes = new Set(
					node.attributes
						.filter((attribute) => attribute.type === "JSXAttribute")
						.map((attribute) => attribute.name.name),
				);
				if (!attributes.has("seedColor") || !attributes.has("colorScheme")) {
					context.report({ node, messageId: "missingTheme" });
				}
			},
		};
	},
};

export const dayovaUiPlugin = {
	rules: {
		"no-direct-overlay-primitives": noDirectOverlayPrimitives,
		"no-direct-native-controls": noDirectNativeControls,
		"require-compose-host-theme": requireComposeHostTheme,
	},
};
