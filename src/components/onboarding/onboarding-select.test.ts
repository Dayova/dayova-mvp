import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import { describe, expect, test } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const authFlowSource = readFileSync(
	resolve(testDirectory, "../../features/auth/dayova-auth-flow.tsx"),
	"utf8",
);
const authFlowFile = ts.createSourceFile(
	"dayova-auth-flow.tsx",
	authFlowSource,
	ts.ScriptTarget.Latest,
	true,
	ts.ScriptKind.TSX,
);

function getSourceSection(startMarker: string, endMarker: string) {
	const start = authFlowSource.indexOf(startMarker);
	const end = authFlowSource.indexOf(endMarker);

	if (start < 0 || end <= start) {
		throw new Error(
			`Could not determine source boundaries: ${startMarker} -> ${endMarker}`,
		);
	}

	return authFlowSource.slice(start, end);
}

function findSelfClosingElements(componentName: string) {
	const matches: ts.JsxSelfClosingElement[] = [];

	function visit(node: ts.Node) {
		if (
			ts.isJsxSelfClosingElement(node) &&
			node.tagName.getText(authFlowFile) === componentName
		) {
			matches.push(node);
		}
		ts.forEachChild(node, visit);
	}

	visit(authFlowFile);
	return matches;
}

function getAttributeText(element: ts.JsxSelfClosingElement, name: string) {
	const attribute = element.attributes.properties.find(
		(property): property is ts.JsxAttribute =>
			ts.isJsxAttribute(property) &&
			property.name.getText(authFlowFile) === name,
	);
	return attribute?.initializer?.getText(authFlowFile);
}

function getElementByTestId(componentName: string, testID: string) {
	const element = findSelfClosingElements(componentName).find(
		(candidate) => getAttributeText(candidate, "testID") === `"${testID}"`,
	);

	if (!element) {
		throw new Error(`Could not find ${componentName} with testID ${testID}`);
	}

	return element;
}

const wheelAnswerSource = getSourceSection(
	"function WheelAnswer",
	"function IntroDots",
);
const pickerInputTriggerSource = getSourceSection(
	"function PickerInputTrigger",
	"function OnboardingSelect",
);

describe("onboarding select fields", () => {
	test("use Dayova select sheets instead of platform-native dropdown menus", () => {
		const expoUiImports = authFlowFile.statements.filter(
			(statement): statement is ts.ImportDeclaration =>
				ts.isImportDeclaration(statement) &&
				ts.isStringLiteral(statement.moduleSpecifier) &&
				statement.moduleSpecifier.text === "@expo/ui",
		);
		const gradeSelect = getElementByTestId(
			"OnboardingSelect",
			"onboarding-grade-picker",
		);
		const stateSelect = getElementByTestId(
			"OnboardingSelect",
			"onboarding-state-picker",
		);
		const selectSheets = findSelfClosingElements("SelectSheet");

		expect(expoUiImports).toHaveLength(0);
		expect(wheelAnswerSource).not.toContain("NativeOnboardingPicker");
		expect(selectSheets).toHaveLength(1);
		expect(getAttributeText(selectSheets[0], "title")).toBe("{title}");
		expect(getAttributeText(gradeSelect, "title")).toBe(
			'"Klassenstufe auswählen"',
		);
		expect(getAttributeText(stateSelect, "title")).toBe(
			'"Bundesland auswählen"',
		);
	});

	test("keep the selected label centered inside the closed pill", () => {
		const onboardingTrigger = findSelfClosingElements(
			"PickerInputTrigger",
		).find((element) => getAttributeText(element, "expanded") === "{visible}");

		expect(onboardingTrigger).toBeDefined();
		expect(
			onboardingTrigger?.attributes.properties.some(
				(property) =>
					ts.isJsxAttribute(property) &&
					property.name.getText(authFlowFile) === "centered" &&
					property.initializer === undefined,
			),
		).toBe(true);
		expect(pickerInputTriggerSource).toMatch(
			/centered\s*\?\s*{\s*paddingHorizontal:\s*28,\s*textAlign:\s*"center",?\s*}/s,
		);
		expect(pickerInputTriggerSource).toMatch(
			/style={centered\s*\?\s*{\s*position:\s*"absolute",\s*right:\s*20\s*}\s*:\s*undefined}/s,
		);
		expect(pickerInputTriggerSource).toMatch(
			/accessibilityState={expanded\s*===\s*undefined\s*\?\s*undefined\s*:\s*{\s*expanded\s*}}/s,
		);
	});
});
