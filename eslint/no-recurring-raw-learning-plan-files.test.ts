import { fileURLToPath } from "node:url";
import { parser } from "typescript-eslint";
import { type Rule, RuleTester } from "eslint";
import { noRecurringRawLearningPlanFiles } from "./dayova-convex-plugin.mjs";

const ruleTester = new RuleTester({
	languageOptions: {
		parser,
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
				code: 'const filePartType = "file"; const part = {type: filePartType, data: buffer};',
				filename: "/repo/convex/learningPlanAi.ts",
				errors: [{ messageId: "rawFile" }],
			},
			{
				code: 'const part = {type: ("file" as const), data: buffer};',
				filename: "/repo/convex/learningPlanAi.ts",
				errors: [{ messageId: "rawFile" }],
			},
			{
				code: 'import {filePart} from "../raw-file-part"; const request = {content: [filePart]};',
				filename: fileURLToPath(
					new URL("./fixtures/convex/learningPlanAi.ts", import.meta.url),
				),
				errors: [{ messageId: "rawFile" }],
			},
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
