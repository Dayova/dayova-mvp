import { type Rule, RuleTester } from "eslint";
import { noInterfaceShadows } from "./dayova-ui-plugin.mjs";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module",
	},
});

ruleTester.run("no-interface-shadows", noInterfaceShadows as Rule.RuleModule, {
	valid: [
		{
			code: 'const card = <View className="border border-border bg-card shadow-none" />;',
			filename: "/repo/src/components/ui/surface.tsx",
		},
		{
			code: 'const artwork = <View className="shadow-black/10 shadow-lg" />;',
			filename: "/repo/src/components/onboarding/intro-tasks-artwork.tsx",
		},
		{
			code: 'const card = <View className={`bg-card shadow-none hover:shadow-none ${extra}`} />;',
			filename: "/repo/src/components/ui/surface.tsx",
		},
		{
			code: 'const artwork = <View className={`shadow shadow-lg`} />;',
			filename: "/repo/src/components/onboarding/intro-tasks-artwork.tsx",
		},
		{
			code: 'const card = <View className={`shadow-${"none"}`} />;',
			filename: "/repo/src/components/ui/surface.tsx",
		},
		{
			code: 'const card = <View className={`shadow${"-none"}`} />;',
			filename: "/repo/src/components/ui/surface.tsx",
		},
	],
	invalid: [
		{
			code: 'const card = <View className="shadow" />;',
			filename: "/repo/src/components/ui/surface.tsx",
			errors: [{ messageId: "shadow" }],
		},
		{
			code: 'const card = <View className="hover:shadow bg-card" />;',
			filename: "/repo/src/components/ui/surface.tsx",
			errors: [{ messageId: "shadow" }],
		},
		{
			code: 'const card = <View className={`shadow-lg`} />;',
			filename: "/repo/src/components/ui/surface.tsx",
			errors: [{ messageId: "shadow" }],
		},
		{
			code: 'const card = <View className={`${extra} shadow bg-card`} />;',
			filename: "/repo/src/components/ui/surface.tsx",
			errors: [{ messageId: "shadow" }],
		},
		{
			code: 'const card = <View className="bg-card shadow-black/10 shadow-sm" />;',
			filename: "/repo/src/components/ui/surface.tsx",
			errors: [{ messageId: "shadow" }],
		},
		{
			code: 'const style = { boxShadow: "0 4px 12px rgba(0,0,0,.1)" };',
			filename: "/repo/src/app/profile.tsx",
			errors: [{ messageId: "shadow" }],
		},
		{
			code: "const style = { shadowOpacity: 0.1, elevation: 4 };",
			filename: "/repo/src/app/notifications.tsx",
			errors: [
				{ messageId: "shadow", data: { name: "shadowOpacity" } },
				{ messageId: "shadow", data: { name: "elevation" } },
			],
		},
		{
			code: "const overlap = { elevation: 20 };",
			filename: "/repo/src/components/ui/notched-action-card.tsx",
			errors: [{ messageId: "shadow", data: { name: "elevation" } }],
		},
	],
});
