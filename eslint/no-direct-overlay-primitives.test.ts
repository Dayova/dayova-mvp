import { type Rule, RuleTester } from "eslint";
import { noDirectOverlayPrimitives } from "./dayova-ui-plugin.mjs";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

ruleTester.run(
	"no-direct-overlay-primitives",
	noDirectOverlayPrimitives as Rule.RuleModule,
	{
	valid: [
		{
			code: 'import { BottomSheetModal } from "@gorhom/bottom-sheet";',
			filename: "/repo/src/components/ui/dayova-sheet-frame.tsx",
		},
		{
			code: 'import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";',
			filename: "/repo/src/app/_layout.tsx",
		},
		{
			code: 'import { View } from "react-native";',
			filename: "/repo/src/app/example.tsx",
		},
	],
	invalid: [
		{
			code: 'import "@gorhom/bottom-sheet";',
			filename: "/repo/src/app/_layout.tsx",
			errors: [{ messageId: "gorhom" }],
		},
		{
			code: 'import { BottomSheetModal } from "@gorhom/bottom-sheet";',
			filename: "/repo/src/app/example.tsx",
			errors: [{ messageId: "gorhom" }],
		},
		{
			code: 'import { Alert, Modal } from "react-native";',
			filename: "/repo/src/app/example.tsx",
			errors: [
				{ messageId: "native", data: { name: "Alert" } },
				{ messageId: "native", data: { name: "Modal" } },
			],
		},
		{
			code: 'import * as RN from "react-native"; RN.Alert.alert("No");',
			filename: "/repo/src/app/example.tsx",
			errors: [{ messageId: "nativeNamespace" }],
		},
		],
	},
);
