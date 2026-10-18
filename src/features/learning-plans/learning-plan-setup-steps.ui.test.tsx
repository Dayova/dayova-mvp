import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";
import type { Id } from "#convex/_generated/dataModel";
import { ExamHintsEditor } from "./exam-hints-editor";
import {
	ExamHintsStep,
	MaterialUploadStep,
	RequiredTopicsStep,
} from "./learning-plan-setup-steps";

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));
jest.mock("react-native-keyboard-controller", () => {
	const { View, ScrollView } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return { KeyboardStickyView: View, KeyboardAwareScrollView: ScrollView };
});

jest.mock("react-native-reanimated", () =>
	jest.requireActual("../../../tests/mocks/selection-reanimated.cjs"),
);
jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);
	return {
		Attachment: Icon,
		CalendarDays: Icon,
		ChevronDown: Icon,
		Clock3: Icon,
		GraduationCap: Icon,
		Plus: Icon,
		Search: Icon,
		Check: Icon,
		PropertyEdit: Icon,
		X: Icon,
	};
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			primary: "#00A0E6",
			primaryStrong: "#00A0E6",
			secondaryText: "#697586",
			text: "#111111",
		},
	}),
}));

describe("learning-plan setup steps", () => {
	test("topic page contains only topic search and Continue", async () => {
		const next = jest.fn();
		const screen = await render(
			<RequiredTopicsStep
				subject="Deutsch"
				searchTopics={async () => ({ topics: [], truncated: false })}
				selectedTopics={["Gedichtanalyse"]}
				onChangeSelectedTopics={jest.fn()}
				canContinue
				isBusy={false}
				errorMessage={null}
				onContinue={next}
			/>,
		);
		expect(screen.getByLabelText("Themen suchen")).toBeOnTheScreen();
		expect(screen.queryByLabelText("Hinweise suchen")).toBeNull();
		expect(
			screen.queryByLabelText("Hinweise zur Prüfung (optional)"),
		).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(next).toHaveBeenCalledTimes(1);
	});

	test("hint search adds, selects and removes multiple suggestions and a custom condition", async () => {
		const changes = jest.fn();
		function Harness() {
			const [value, setValue] = useState(
				"Teil 1 ohne Hilfsmittel; Teil 2 mit Formelsammlung.",
			);
			return (
				<ExamHintsEditor
					subject="Mathe LK"
					selectedTopics={["Vektoren"]}
					value={value}
					onChange={(next) => {
						setValue(next);
						changes(next);
					}}
				/>
			);
		}
		const screen = await render(<Harness />);
		expect(
			screen.queryByLabelText("Hinweise zur Prüfung (optional)"),
		).toBeNull();
		await fireEvent.changeText(
			screen.getByLabelText("Hinweise suchen"),
			"lösung",
		);
		expect(
			screen.queryByRole("checkbox", { name: "Ohne Taschenrechner" }),
		).toBeNull();
		await fireEvent.press(
			screen.getByRole("checkbox", { name: "Lösungsweg angeben" }),
		);
		expect(screen.getByLabelText("Hinweise suchen")).toHaveDisplayValue("");
		expect(
			screen.getByRole("checkbox", { name: "Lösungsweg angeben" }),
		).toBeChecked();
		await fireEvent.press(
			screen.getByRole("checkbox", { name: "Skizzen beschriften" }),
		);
		await fireEvent.changeText(
			screen.getByLabelText("Hinweise suchen"),
			"Nur Aufgabe 3 mit Rechner",
		);
		await fireEvent.press(
			screen.getByRole("checkbox", { name: "Nur Aufgabe 3 mit Rechner" }),
		);
		expect(changes).toHaveBeenLastCalledWith(
			"Teil 1 ohne Hilfsmittel; Teil 2 mit Formelsammlung.\nLösungsweg angeben\nSkizzen beschriften\nNur Aufgabe 3 mit Rechner",
		);
		await fireEvent.press(
			screen.getByRole("button", { name: "Lösungsweg angeben entfernen" }),
		);
		expect(
			screen.getByRole("checkbox", { name: "Lösungsweg angeben" }),
		).not.toBeChecked();
		expect(changes).toHaveBeenLastCalledWith(
			"Teil 1 ohne Hilfsmittel; Teil 2 mit Formelsammlung.\nSkizzen beschriften\nNur Aufgabe 3 mit Rechner",
		);
	});

	test("preserves legacy whitespace and scoped conditions when removing a hint", async () => {
		const note =
			"  Analysis ohne Taschenrechner; Stochastik mit Formelsammlung.  \n\nSkizzen beschriften\n";
		const change = jest.fn();
		const screen = await render(
			<ExamHintsEditor
				subject="Mathe LK"
				selectedTopics={["Vektoren"]}
				value={note}
				onChange={change}
			/>,
		);
		expect(change).not.toHaveBeenCalled();
		await fireEvent.press(
			screen.getByRole("button", { name: "Skizzen beschriften entfernen" }),
		);
		expect(change).toHaveBeenLastCalledWith(
			"  Analysis ohne Taschenrechner; Stochastik mit Formelsammlung.  \n\n",
		);
	});

	test("hint page permits continuing empty and locks search, selections and Continue while saving", async () => {
		const props = {
			subject: "Deutsch",
			selectedTopics: ["Gedichtanalyse"],
			additionalInfo: "",
			onChange: jest.fn(),
			onContinue: jest.fn(),
			isBusy: false,
			canContinue: true,
			errorMessage: null,
		};
		const screen = await render(<ExamHintsStep {...props} />);
		expect(screen.queryByLabelText("Themen suchen")).toBeNull();
		expect(
			screen.queryByLabelText("Hinweise zur Prüfung (optional)"),
		).toBeNull();
		expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();
		await screen.rerender(
			<ExamHintsStep
				{...props}
				additionalInfo="Textbelege mit Zeilenangaben"
				isBusy
				canContinue={false}
			/>,
		);
		expect(screen.getByLabelText("Hinweise suchen")).toHaveProp(
			"editable",
			false,
		);
		expect(
			screen.getByRole("checkbox", { name: "Textbelege mit Zeilenangaben" }),
		).toBeDisabled();
		expect(
			screen.getByRole("button", {
				name: "Textbelege mit Zeilenangaben entfernen",
			}),
		).toBeDisabled();
		expect(
			screen.getByRole("button", { name: "Weiter, wird geladen" }),
		).toBeDisabled();
	});

	test("keeps the empty school-material page focused on one upload action", async () => {
		const onOpenUpload = jest.fn();
		const screen = await render(
			<MaterialUploadStep
				canUpload
				canContinue={false}
				documents={[]}
				errorMessage={null}
				isBusy={false}
				isUploading={false}
				onContinue={jest.fn()}
				onOpenUpload={onOpenUpload}
				onRemoveDocument={jest.fn()}
				onSkip={jest.fn()}
				openingUploadAction={null}
			/>,
		);

		expect(
			screen.getByRole("button", {
				name: "Schulmaterial hinzufügen",
			}),
		).toBeEnabled();
		expect(
			screen.getByText(
				"Dein Lernplan-Entwurf bleibt gespeichert. Schulmaterial kannst du später ergänzen.",
			),
		).toBeOnTheScreen();
		expect(
			screen.queryByRole("button", {
				name: "Zusätzliche Lernhilfe hinzufügen",
			}),
		).toBeNull();
		expect(screen.queryByRole("button", { name: "Weiter" })).toBeNull();
		expect(
			screen.getByRole("button", {
				name: "Ohne Lernmaterial erstellen",
			}),
		).toBeOnTheScreen();

		await fireEvent.press(
			screen.getByRole("button", { name: "Schulmaterial hinzufügen" }),
		);
		expect(onOpenUpload).toHaveBeenCalledWith();
	});

	test("reveals continue after school material is uploaded", async () => {
		const onRemoveDocument = jest.fn();
		const screen = await render(
			<MaterialUploadStep
				canUpload
				canContinue
				documents={[
					{
						id: "document" as Id<"learningPlanDocuments">,
						fileName: "Arbeitsblatt.pdf",
						fileType: "application/pdf",
						fileSizeBytes: 1_024,
						sourceKind: "school",
					},
				]}
				errorMessage={null}
				isBusy={false}
				isUploading={false}
				onContinue={jest.fn()}
				onOpenUpload={jest.fn()}
				onRemoveDocument={onRemoveDocument}
				onSkip={jest.fn()}
				openingUploadAction={null}
			/>,
		);

		expect(
			screen.getByRole("button", {
				name: "Weiteres Schulmaterial hinzufügen",
			}),
		).toBeEnabled();
		expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();
		expect(
			screen.queryByRole("button", {
				name: "Zusätzliche Lernhilfe hinzufügen",
			}),
		).toBeNull();
		expect(
			screen.queryByRole("button", {
				name: "Ohne Lernmaterial erstellen",
			}),
		).toBeNull();
		expect(screen.queryByText("Entfernen")).toBeNull();
		await fireEvent.press(
			screen.getByRole("button", { name: "Arbeitsblatt.pdf entfernen" }),
		);
		expect(onRemoveDocument).toHaveBeenCalledWith("document");
	});

	test("still offers the no-plan path when only an external aid remains", async () => {
		const screen = await render(
			<MaterialUploadStep
				canUpload
				canContinue={false}
				documents={[
					{
						id: "external-document" as Id<"learningPlanDocuments">,
						fileName: "Lernhilfe.pdf",
						fileType: "application/pdf",
						fileSizeBytes: 1_024,
						sourceKind: "external",
					},
				]}
				errorMessage={null}
				isBusy={false}
				isUploading={false}
				onContinue={jest.fn()}
				onOpenUpload={jest.fn()}
				onRemoveDocument={jest.fn()}
				onSkip={jest.fn()}
				openingUploadAction={null}
			/>,
		);

		expect(screen.queryByRole("button", { name: "Weiter" })).toBeNull();
		expect(screen.queryByText("Lernhilfe.pdf")).toBeNull();
		expect(
			screen.getByRole("button", { name: "Ohne Lernmaterial erstellen" }),
		).toBeOnTheScreen();
	});

	test("requires material when a materialless draft is resumed", async () => {
		const screen = await render(
			<MaterialUploadStep
				canUpload
				canContinue={false}
				documents={[]}
				errorMessage={null}
				isBusy={false}
				isUploading={false}
				onContinue={jest.fn()}
				onOpenUpload={jest.fn()}
				onRemoveDocument={jest.fn()}
				onSkip={jest.fn()}
				openingUploadAction={null}
				showSkip={false}
			/>,
		);

		expect(
			screen.getByText(
				"Deine Unterlagen bilden die Grundlage für deinen Lernplan.",
			),
		).toBeOnTheScreen();
		expect(
			screen.queryByRole("button", { name: "Ohne Lernmaterial erstellen" }),
		).toBeNull();
	});

	test("disables the topic continuation until the answer is valid", async () => {
		const screen = await render(
			<RequiredTopicsStep
				subject="Mathematik"
				searchTopics={async () => ({ topics: [], truncated: false })}
				canContinue={false}
				errorMessage={null}
				isBusy={false}
				selectedTopics={[]}
				onChangeSelectedTopics={jest.fn()}
				onContinue={jest.fn()}
			/>,
		);

		expect(screen.queryByLabelText("Hinweise suchen")).toBeNull();
		expect(screen.getByRole("button", { name: "Weiter" })).toBeDisabled();
	});
});
