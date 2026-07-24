import { type Rule, RuleTester } from "eslint";
import {
	noDirectNativeControls,
	requireComposeHostTheme,
} from "./dayova-ui-plugin.mjs";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module",
	},
});

ruleTester.run(
	"no-direct-native-controls",
	noDirectNativeControls as Rule.RuleModule,
	{
		valid: [
			{
				code: 'import { Switch } from "@expo/ui";',
				filename: "/repo/src/components/ui/switch.ios.tsx",
			},
			{
				code: 'import { DatePickerDialog } from "@expo/ui/jetpack-compose";',
				filename:
					"/repo/src/components/ui/date-time-picker-sheet.android.tsx",
			},
			{
				code: `
					import * as Compose from "@expo/ui/jetpack-compose";
					const picker = <Compose.DatePickerDialog />;
				`,
				filename:
					"/repo/src/components/ui/date-time-picker-sheet.android.tsx",
			},
		],
		invalid: [
			{
				code: 'import { Switch } from "react-native";',
				filename: "/repo/src/app/settings.tsx",
				errors: [{ messageId: "switch" }],
			},
			{
				code: 'import { Switch } from "@expo/ui";',
				filename: "/repo/src/app/settings.tsx",
				errors: [{ messageId: "switch" }],
			},
			{
				code: 'import { Picker } from "@expo/ui";',
				filename: "/repo/src/app/onboarding.tsx",
				errors: [{ messageId: "picker" }],
			},
			{
				code: 'import { TimePickerDialog } from "@expo/ui/jetpack-compose";',
				filename: "/repo/src/app/settings.tsx",
				errors: [{ messageId: "dateTime" }],
			},
			{
				code: `
					import * as RN from "react-native";
					const control = <RN.Switch />;
				`,
				filename: "/repo/src/app/settings.tsx",
				errors: [{ messageId: "switch" }],
			},
			{
				code: `
					import * as UI from "@expo/ui";
					const control = <UI.Picker />;
				`,
				filename: "/repo/src/app/onboarding.tsx",
				errors: [{ messageId: "picker" }],
			},
			{
				code: `
					import * as Compose from "@expo/ui/jetpack-compose";
					const picker = <Compose.TimePickerDialog />;
				`,
				filename: "/repo/src/app/settings.tsx",
				errors: [{ messageId: "dateTime" }],
			},
		],
	},
);

ruleTester.run(
	"require-compose-host-theme",
	requireComposeHostTheme as Rule.RuleModule,
	{
		valid: [
			{
				code: `
					import { Host } from "@expo/ui/jetpack-compose";
					const screen = <Host seedColor={primary} colorScheme={theme} />;
				`,
				filename: "/repo/src/components/ui/switch.android.tsx",
			},
			{
				code: `
					import * as Compose from "@expo/ui/jetpack-compose";
					const screen = <Compose.Host seedColor={primary} colorScheme={theme} />;
				`,
				filename: "/repo/src/components/ui/example.android.tsx",
			},
		],
		invalid: [
			{
				code: `
					import { Host as ComposeHost } from "@expo/ui/jetpack-compose";
					const screen = <ComposeHost seedColor={primary} />;
				`,
				filename: "/repo/src/components/ui/example.android.tsx",
				errors: [{ messageId: "missingTheme" }],
			},
			{
				code: `
					import * as Compose from "@expo/ui/jetpack-compose";
					const screen = <Compose.Host colorScheme={theme} />;
				`,
				filename: "/repo/src/components/ui/example.android.tsx",
				errors: [{ messageId: "missingTheme" }],
			},
			{
				code: `
					import * as Compose from "@expo/ui/jetpack-compose";
					const screen = <Compose.Host seedColor={primary} />;
				`,
				filename: "/repo/src/components/ui/example.android.tsx",
				errors: [{ messageId: "missingTheme" }],
			},
			{
				code: `
					import * as Compose from "@expo/ui/jetpack-compose";
					const screen = <Compose.Host />;
				`,
				filename: "/repo/src/components/ui/example.android.tsx",
				errors: [{ messageId: "missingTheme" }],
			},
		],
	},
);
