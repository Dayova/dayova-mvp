import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parser } from "typescript-eslint";

const LEARNING_PLAN_AI_PATH = "/convex/learningPlanAi.ts";
const ONE_TIME_EXTRACTION_FUNCTION = "extractDocumentWithVision";

// Resolve only immutable local declarations and relative source imports. Unknown
// expressions stay unknown; this guard is not a general JavaScript evaluator.
const unwrap = (node) => {
	while (
		node &&
		[
			"TSAsExpression",
			"TSSatisfiesExpression",
			"TSTypeAssertion",
			"TSNonNullExpression",
		].includes(node.type)
	)
		node = node.expression;
	return node;
};

const resolveValue = (expression, lookup, seen = new Set()) => {
	const node = unwrap(expression);
	if (!node || seen.has(node)) return undefined;
	const next = new Set(seen).add(node);
	if (node.type === "Literal") return node.value;
	if (node.type === "Identifier") {
		const binding = lookup(node.name);
		return binding
			? resolveValue(binding.node, binding.lookup ?? lookup, next)
			: undefined;
	}
	if (node.type === "ObjectExpression") {
		const value = {};
		for (const property of node.properties) {
			if (property.type === "SpreadElement")
				Object.assign(value, resolveValue(property.argument, lookup, next));
			else if (property.type === "Property") {
				const key = property.computed
					? resolveValue(property.key, lookup, next)
					: (property.key.name ?? property.key.value);
				if (typeof key === "string")
					value[key] = resolveValue(property.value, lookup, next);
			}
		}
		return value;
	}
	if (node.type === "ArrayExpression")
		return node.elements.map((item) => resolveValue(item, lookup, next));
	return undefined;
};

const importedBinding = (filename, source, name, cache) => {
	if (!source.startsWith(".")) return undefined;
	const base = resolve(dirname(filename), source);
	const file = [
		base,
		...[".ts", ".tsx", ".js", ".mjs"].map((ext) => base + ext),
	].find((candidate) => existsSync(candidate));
	if (!file) return undefined;
	if (!cache.has(file)) {
		cache.set(file, new Map());
		try {
			const ast = parser.parseForESLint(readFileSync(file, "utf8"), {
				sourceType: "module",
				ecmaVersion: "latest",
			}).ast;
			const declarations = cache.get(file);
			const lookup = (key) => declarations.get(key);
			for (const statement of ast.body) {
				const declaration = statement.declaration ?? statement;
				if (
					declaration.type === "VariableDeclaration" &&
					declaration.kind === "const"
				) {
					for (const item of declaration.declarations)
						if (item.id.type === "Identifier")
							declarations.set(item.id.name, { node: item.init, lookup });
				}
				if (statement.type === "ExportDefaultDeclaration")
					declarations.set("default", { node: declaration, lookup });
			}
		} catch {
			return undefined;
		}
	}
	return cache.get(file).get(name);
};

const containsFilePart = (value) =>
	value &&
	typeof value === "object" &&
	(value.type === "file" || Object.values(value).some(containsFilePart));

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

		const imports = new Map();
		const bindingFor = (node, name) => {
			let scope = context.sourceCode.getScope(node);
			while (scope) {
				const variable = scope.set.get(name);
				if (variable) {
					const definition = variable.defs[0];
					if (
						definition?.type === "Variable" &&
						definition.parent.kind === "const"
					)
						return { node: definition.node.init };
					if (definition?.type === "ImportBinding") {
						const specifier = definition.node;
						const imported =
							specifier.type === "ImportDefaultSpecifier"
								? "default"
								: specifier.imported?.name;
						if (imported)
							return importedBinding(
								filename,
								definition.parent.source.value,
								imported,
								imports,
							);
					}
					return undefined;
				}
				scope = scope.upper;
			}
		};
		return {
			ObjectExpression(node) {
				const value = resolveValue(node, (name) => bindingFor(node, name));
				if (value?.type !== "file" || isInsideOneTimeExtraction(node)) return;
				context.report({ node, messageId: "rawFile" });
			},
			Identifier(node) {
				if (
					node.parent.type.startsWith("Import") ||
					isInsideOneTimeExtraction(node)
				)
					return;
				const binding = bindingFor(node, node.name);
				// Imported objects have their own lookup scope. Local literals are
				// already reported at their construction above.
				if (
					binding?.lookup &&
					containsFilePart(resolveValue(binding.node, binding.lookup))
				)
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
