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
	test("searches hints, adds several suggestions and a custom condition without replacing existing text", async () => {
		function Harness() {
			const [value, setValue] = useState(
				"Teil 1 ohne Hilfsmittel; Teil 2 mit Formelsammlung.",
			);
			return (
				<ExamHintsEditor
					subject="Mathe LK"
					selectedTopics={["Vektoren"]}
					value={value}
					onChange={setValue}
				/>
			);
		}
		const screen = await render(<Harness />);
		await fireEvent.changeText(
			screen.getByLabelText("Hinweise suchen"),
			"lösung",
		);
		expect(
			screen.queryByRole("button", {
				name: "Beispiel übernehmen: Ohne Taschenrechner",
			}),
		).toBeNull();
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Beispiel übernehmen: Lösungsweg angeben",
			}),
		);
		expect(screen.getByLabelText("Hinweise suchen")).toHaveDisplayValue("");
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Beispiel übernehmen: Skizzen beschriften",
			}),
		);
		await fireEvent.changeText(
			screen.getByLabelText("Hinweise suchen"),
			"Nur Aufgabe 3 mit Rechner",
		);
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Eigenen Hinweis hinzufügen: Nur Aufgabe 3 mit Rechner",
			}),
		);
		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		).toHaveDisplayValue(
			"Teil 1 ohne Hilfsmittel; Teil 2 mit Formelsammlung.\nLösungsweg angeben\nSkizzen beschriften\nNur Aufgabe 3 mit Rechner",
		);
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Beispiel übernehmen: Lösungsweg angeben",
			}),
		);
		expect(
			screen
				.getByLabelText("Hinweise zur Prüfung (optional)")
				.props.value.match(/Lösungsweg angeben/g),
		).toHaveLength(1);
	});

	test("both placements share the same opt-in examples and preserve long text when adding one", async () => {
		const note =
			"Analysis ohne Taschenrechner; Stochastik mit Formelsammlung. ".repeat(8);
		const change = jest.fn();
		const screen = await render(
			<ExamHintsStep
				subject="Mathe LK"
				selectedTopics={["Vektoren"]}
				additionalInfo={note}
				onChange={change}
				onDone={jest.fn()}
				isBusy={false}
			/>,
		);
		expect(change).not.toHaveBeenCalled();
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Beispiel übernehmen: Lösungsweg angeben",
			}),
		);
		expect(change).toHaveBeenCalledWith(`${note}\nLösungsweg angeben`);
		await screen.rerender(
			<ExamHintsStep
				subject="Deutsch"
				selectedTopics={["Gedichtanalyse"]}
				additionalInfo={note}
				onChange={change}
				onDone={jest.fn()}
				isBusy
			/>,
		);
		expect(screen.getByLabelText("Hinweise zur Prüfung (optional)")).toHaveProp(
			"editable",
			false,
		);
		expect(
			screen.getByRole("button", {
				name: "Beispiel übernehmen: Textbelege mit Zeilenangaben",
			}),
		).toBeDisabled();
		expect(
			screen.queryByRole("button", {
				name: "Beispiel übernehmen: Ohne Taschenrechner",
			}),
		).toBeNull();
	});
	test("collects required exam topics before material upload", async () => {
		const onChangeTopics = jest.fn();
		const onContinue = jest.fn();
		const screen = await render(
			<RequiredTopicsStep
				subject="Mathematik"
				searchTopics={async () => ({ topics: [], truncated: false })}
				canContinue
				errorMessage={null}
				isBusy={false}
				onChangeAdditionalInfo={onChangeTopics}
				selectedTopics={[]}
				onChangeSelectedTopics={jest.fn()}
				onContinue={onContinue}
				additionalInfo="Lineare Gleichungen und Funktionen"
			/>,
		);

		expect(
			screen.getByText("Welche Themen kommen in der Prüfung dran?"),
		).toBeOnTheScreen();
		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		).toHaveDisplayValue("Lineare Gleichungen und Funktionen");
		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)").props.className,
		).toContain("border-border");
		expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();

		await fireEvent.changeText(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
			"Lineare Funktionen, Steigung und Achsenabschnitt",
		);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));

		expect(onChangeTopics).toHaveBeenCalledWith(
			"Lineare Funktionen, Steigung und Achsenabschnitt",
		);
		expect(onContinue).toHaveBeenCalledTimes(1);
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
				onChangeAdditionalInfo={jest.fn()}
				selectedTopics={[]}
				onChangeSelectedTopics={jest.fn()}
				onContinue={jest.fn()}
				additionalInfo="Mathe"
			/>,
		);

		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		).toHaveDisplayValue("Mathe");
		expect(screen.getByRole("button", { name: "Weiter" })).toBeDisabled();
	});
});
