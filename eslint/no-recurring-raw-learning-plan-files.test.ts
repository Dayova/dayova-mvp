import { type Rule, RuleTester } from "eslint";
import { noRecurringRawLearningPlanFiles } from "./dayova-convex-plugin.mjs";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

ruleTester.run(
	"no-recurring-raw-learning-plan-files",
	noRecurringRawLearningPlanFiles as Rule.RuleModule,
	{
		valid: [
			{
				code: `
					const extractDocumentWithVision = async () => ({
						type: "file",
						data: buffer,
					});
				`,
				filename: "/repo/convex/learningPlanAi.ts",
			},
			{
				code: 'const content = { type: "text", text: sourceContext };',
				filename: "/repo/convex/learningPlanAi.ts",
			},
			{
				code: 'const content = { type: "file", data: buffer };',
				filename: "/repo/convex/unrelated.ts",
			},
		],
		invalid: [
			{
				code: `
					const generatePlan = async () => ({
						type: "file",
						data: buffer,
					});
				`,
				filename: "/repo/convex/learningPlanAi.ts",
				errors: [{ messageId: "rawFile" }],
			},
		],
	},
);
