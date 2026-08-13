import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type { Id } from "#convex/_generated/dataModel";
import {
	MaterialUploadStep,
	RequiredTopicsStep,
} from "./learning-plan-setup-steps";

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
	test("collects required exam topics before material upload", async () => {
		const onChangeTopics = jest.fn();
		const onContinue = jest.fn();
		const screen = await render(
			<RequiredTopicsStep
				canContinue
				errorMessage={null}
				isBusy={false}
				onChangeTopics={onChangeTopics}
				onContinue={onContinue}
				topics="Lineare Gleichungen und Funktionen"
			/>,
		);

		expect(
			screen.getByText("Welche Themen kommen in der Prüfung dran?"),
		).toBeOnTheScreen();
		expect(screen.getByLabelText("Prüfungsthemen")).toHaveDisplayValue(
			"Lineare Gleichungen und Funktionen",
		);
		expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();

		await fireEvent.changeText(
			screen.getByLabelText("Prüfungsthemen"),
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
				name: "Material später hochladen",
			}),
		).toBeOnTheScreen();

		await fireEvent.press(
			screen.getByRole("button", { name: "Schulmaterial hinzufügen" }),
		);
		expect(onOpenUpload).toHaveBeenCalledWith();
	});

	test("reveals continue after school material is uploaded", async () => {
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
				onRemoveDocument={jest.fn()}
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
				name: "Material später hochladen",
			}),
		).toBeNull();
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
			screen.getByRole("button", { name: "Material später hochladen" }),
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
			screen.queryByRole("button", { name: "Material später hochladen" }),
		).toBeNull();
	});

	test("disables the topic continuation until the answer is valid", async () => {
		const screen = await render(
			<RequiredTopicsStep
				canContinue={false}
				errorMessage={null}
				isBusy={false}
				onChangeTopics={jest.fn()}
				onContinue={jest.fn()}
				topics="Mathe"
			/>,
		);

		expect(screen.getByLabelText("Prüfungsthemen")).toHaveDisplayValue("Mathe");
		expect(screen.getByRole("button", { name: "Weiter" })).toBeDisabled();
	});
});
