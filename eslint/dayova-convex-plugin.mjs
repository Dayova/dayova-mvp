const LEARNING_PLAN_AI_PATH = "/convex/learningPlanAi.ts";
const ONE_TIME_EXTRACTION_FUNCTION = "extractDocumentWithVision";

const isFileTypeProperty = (property) =>
	property.type === "Property" &&
	!property.computed &&
	((property.key.type === "Identifier" && property.key.name === "type") ||
		(property.key.type === "Literal" && property.key.value === "type")) &&
	property.value.type === "Literal" &&
	property.value.value === "file";

const isInsideOneTimeExtraction = (node) => {
	let current = node.parent;
	while (current) {
		if (
			current.type === "VariableDeclarator" &&
			current.id.type === "Identifier" &&
			current.id.name === ONE_TIME_EXTRACTION_FUNCTION
		) {
			return true;
		}
		current = current.parent;
	}
	return false;
};

export const noRecurringRawLearningPlanFiles = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Keep raw learning-plan file transport inside one-time document extraction.",
		},
		messages: {
			rawFile:
				"Raw file parts may only be sent by extractDocumentWithVision during one-time ingestion. Recurring AI calls must use persisted text chunks.",
		},
		schema: [],
	},
	create(context) {
		const filename = context.filename.replaceAll("\\", "/");
		if (!filename.endsWith(LEARNING_PLAN_AI_PATH)) return {};

		return {
			ObjectExpression(node) {
				if (!node.properties.some(isFileTypeProperty)) return;
				if (isInsideOneTimeExtraction(node)) return;
				context.report({ node, messageId: "rawFile" });
			},
		};
	},
};

export const dayovaConvexPlugin = {
	rules: {
		"no-recurring-raw-learning-plan-files": noRecurringRawLearningPlanFiles,
	},
};
