import { type Rule, RuleTester } from "eslint";
import { noTestModulesInRouter } from "./dayova-ui-plugin.mjs";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

ruleTester.run(
	"no-test-modules-in-router",
	noTestModulesInRouter as Rule.RuleModule,
	{
		valid: [
			{
				code: "export default function Route() { return null; }",
				filename: "/repo/src/app/example.tsx",
			},
			{
				code: "test('feature behavior', () => {});",
				filename: "/repo/src/features/example/example.ui.test.tsx",
			},
		],
		invalid: [
			{
				code: "test('route behavior', () => {});",
				filename: "/repo/src/app/example.ui.test.tsx",
				errors: [{ messageId: "testModule" }],
			},
			{
				code: "test('route behavior', () => {});",
				filename: "C:\\repo\\src\\app\\example.spec.ts",
				errors: [{ messageId: "testModule" }],
			},
		],
	},
);
