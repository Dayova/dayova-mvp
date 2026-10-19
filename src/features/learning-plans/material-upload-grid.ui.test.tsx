import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { Id } from "#convex/_generated/dataModel";
import {
	type LoadMaterialPreview,
	MaterialUploadGrid,
} from "./material-upload-grid";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			primaryStrong: "#00A0E6",
			secondaryText: "#697586",
			text: "#1A1A1A",
		},
	}),
}));

const document = {
	id: "photo" as Id<"learningPlanDocuments">,
	fileName: "Mitschrift.jpg",
	fileType: "image/jpeg",
	fileSizeBytes: 2048,
	sourceKind: "school" as const,
};

test("every empty slot opens the source picker, and busy slots cannot open it", async () => {
	const onOpenUpload = jest.fn();
	const screen = await render(
		<MaterialUploadGrid canUpload onOpenUpload={onOpenUpload} />,
	);
	const slots = screen.getAllByRole("button", {
		name: "Schulmaterial hinzufügen",
	});
	expect(slots).toHaveLength(4);
	for (const slot of slots) await fireEvent.press(slot);
	expect(onOpenUpload).toHaveBeenCalledTimes(4);
	await screen.rerender(
		<MaterialUploadGrid canUpload={false} onOpenUpload={onOpenUpload} />,
	);
	const disabledSlots = screen.getAllByRole("button", {
		name: "Schulmaterial hinzufügen",
	});
	expect(disabledSlots).toHaveLength(4);
	for (const slot of disabledSlots) {
		expect(slot).toBeDisabled();
		await fireEvent.press(slot);
	}
	expect(onOpenUpload).toHaveBeenCalledTimes(4);
});

test("a failed photo preview can be retried without removing the uploaded file", async () => {
	const loadPreview = jest
		.fn<LoadMaterialPreview>()
		.mockRejectedValueOnce(new Error("offline"))
		.mockResolvedValueOnce("https://example.test/notes.jpg");
	const onRemoveDocument = jest.fn();
	const screen = await render(
		<MaterialUploadGrid
			canUpload
			documents={[document]}
			loadPreview={loadPreview}
			onRemoveDocument={onRemoveDocument}
		/>,
	);
	await fireEvent.press(
		await screen.findByRole("button", {
			name: "Vorschau für Mitschrift.jpg erneut laden",
		}),
	);
	const preview = await screen.findByLabelText("Vorschau: Mitschrift.jpg");
	expect(preview).toBeOnTheScreen();
	expect(loadPreview).toHaveBeenLastCalledWith({ id: document.id });
	expect(onRemoveDocument).not.toHaveBeenCalled();
	await fireEvent(preview, "error", { nativeEvent: { error: "expired" } });
	expect(
		await screen.findByRole("button", {
			name: "Vorschau für Mitschrift.jpg erneut laden",
		}),
	).toBeEnabled();
	await fireEvent.press(
		screen.getByRole("button", { name: "Mitschrift.jpg entfernen" }),
	);
	expect(onRemoveDocument).toHaveBeenCalledWith("photo");
});

test("documents retain their names and never request an image preview for PDFs", async () => {
	const loadPreview = jest.fn<LoadMaterialPreview>();
	const screen = await render(
		<MaterialUploadGrid
			canUpload
			documents={[
				{
					...document,
					fileName: "Arbeitsblatt.pdf",
					fileType: "application/pdf",
				},
			]}
			loadPreview={loadPreview}
		/>,
	);
	expect(screen.getByText("Arbeitsblatt.pdf")).toBeOnTheScreen();
	expect(screen.getByText("PDF")).toBeOnTheScreen();
	await waitFor(() => expect(loadPreview).not.toHaveBeenCalled());
});
