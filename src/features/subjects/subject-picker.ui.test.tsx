import { describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { InlineSubjectPicker, SubjectAddFlow } from "./subject-picker";
import type { SubjectSelection } from "./use-subject-options";

jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetInput: jest.requireActual<typeof import("~/components/ui/input")>(
		"~/components/ui/input",
	).Input,
	DayovaSheetFrame: ({
		visible,
		title,
		description,
		children,
	}: {
		visible: boolean;
		title: React.ReactNode;
		description?: React.ReactNode;
		children: React.ReactNode;
	}) => {
		const ReactNative =
			jest.requireActual<typeof import("react-native")>("react-native");
		return visible ? (
			<ReactNative.View>
				<ReactNative.Text>{title}</ReactNative.Text>
				{description ? (
					<ReactNative.Text>{description}</ReactNative.Text>
				) : null}
				{children}
			</ReactNative.View>
		) : null;
	},
}));

jest.mock("~/components/ui/button", () => ({
	Button: ({
		children,
		disabled,
		onPress,
	}: {
		children: React.ReactNode;
		disabled?: boolean;
		onPress?: () => void;
	}) => {
		const ReactNative =
			jest.requireActual<typeof import("react-native")>("react-native");
		return (
			<ReactNative.Pressable
				accessibilityRole="button"
				disabled={disabled}
				onPress={onPress}
			>
				{children}
			</ReactNative.Pressable>
		);
	},
}));

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);
	return Object.fromEntries(
		[
			"Check",
			"Plus",
			"BookOpen",
			"Calculator",
			"Chemistry",
			"Code",
			"Dna",
			"Earth",
			"Football",
			"Language",
			"Maps",
			"Mic",
			"MusicNote",
			"PaintBrush",
			"Pencil",
			"TimeManagement",
		].map((name) => [name, Icon]),
	);
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			primary: "#00BAFF",
			secondaryText: "#697586",
		},
	}),
}));

jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
	useQueries: () => ({
		subjects: new Error("[CONVEX Q(personalSubjects:list)] Server Error"),
	}),
	useMutation: () => jest.fn(),
}));
jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));

const personalOption = {
	key: "personal:french",
	name: "Französisch",
	personalSubjectId: "personal-french" as never,
	kind: "personal" as const,
	Icon: () => React.createElement("Icon"),
};

describe("SubjectAddFlow", () => {
	test("reuses an existing subject despite casing and whitespace", async () => {
		const onSelect = jest.fn();
		const onSavePermanent =
			jest.fn<(name: string) => Promise<SubjectSelection>>();
		const screen = await render(
			<SubjectAddFlow
				options={[personalOption]}
				onCancel={jest.fn()}
				onSelect={onSelect}
				onSavePermanent={onSavePermanent}
			/>,
		);

		await act(() =>
			fireEvent.changeText(
				screen.getByLabelText("Name des Fachs"),
				"  französisch  ",
			),
		);
		await act(() =>
			fireEvent.press(screen.getByRole("button", { name: "Weiter" })),
		);

		expect(onSelect).toHaveBeenCalledWith({
			name: "Französisch",
			personalSubjectId: "personal-french",
		});
		expect(onSavePermanent).not.toHaveBeenCalled();
	});

	test("offers permanent and one-time use for a new subject", async () => {
		const onSelect = jest.fn();
		const savedSelection = {
			name: "Latein",
			personalSubjectId: "personal-latin" as never,
		};
		const onSavePermanent = jest.fn<
			(name: string) => Promise<SubjectSelection>
		>(async () => savedSelection);
		const screen = await render(
			<SubjectAddFlow
				options={[]}
				onCancel={jest.fn()}
				onSelect={onSelect}
				onSavePermanent={onSavePermanent}
			/>,
		);

		await act(() =>
			fireEvent.changeText(screen.getByLabelText("Name des Fachs"), "Latein"),
		);
		await act(() =>
			fireEvent.press(screen.getByRole("button", { name: "Weiter" })),
		);
		expect(screen.getByText("Fach dauerhaft hinzufügen?")).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Nur diesmal verwenden" }),
		).toBeOnTheScreen();

		await act(async () => {
			fireEvent.press(
				screen.getByRole("button", { name: "Dauerhaft hinzufügen" }),
			);
		});
		await waitFor(() => expect(onSavePermanent).toHaveBeenCalledWith("Latein"));
		expect(onSelect).toHaveBeenCalledWith(savedSelection);
	});

	test("uses a new subject once without persisting it", async () => {
		const onSelect = jest.fn();
		const onSavePermanent =
			jest.fn<(name: string) => Promise<SubjectSelection>>();
		const screen = await render(
			<SubjectAddFlow
				options={[]}
				onCancel={jest.fn()}
				onSelect={onSelect}
				onSavePermanent={onSavePermanent}
			/>,
		);

		await act(() =>
			fireEvent.changeText(screen.getByLabelText("Name des Fachs"), "Spanisch"),
		);
		await act(() =>
			fireEvent.press(screen.getByRole("button", { name: "Weiter" })),
		);
		await act(() =>
			fireEvent.press(
				screen.getByRole("button", { name: "Nur diesmal verwenden" }),
			),
		);

		expect(onSelect).toHaveBeenCalledWith({
			name: "Spanisch",
			isOneTime: true,
		});
		expect(onSavePermanent).not.toHaveBeenCalled();
	});
});

test("an unavailable personal catalog does not block exam subject selection", async () => {
	const onSelect = jest.fn();
	const screen = await render(
		<InlineSubjectPicker selected={{ name: "" }} onSelect={onSelect} />,
	);
	expect(
		screen.getByText(/Deine persönlichen Fächer konnten nicht geladen werden/),
	).toBeOnTheScreen();
	await act(() =>
		fireEvent.press(screen.getByRole("radio", { name: "Mathematik" })),
	);
	expect(onSelect).toHaveBeenCalledWith({ name: "Mathematik" });
	await act(() =>
		fireEvent.press(screen.getByRole("button", { name: "Fach hinzufügen" })),
	);
	await act(() =>
		fireEvent.changeText(screen.getByLabelText("Name des Fachs"), "Spanisch"),
	);
	await act(() =>
		fireEvent.press(screen.getByRole("button", { name: "Weiter" })),
	);
	await act(() =>
		fireEvent.press(
			screen.getByRole("button", { name: "Nur diesmal verwenden" }),
		),
	);
	expect(onSelect).toHaveBeenLastCalledWith({
		name: "Spanisch",
		isOneTime: true,
	});
});

test("a failed permanent save keeps the language form open without reporting success", async () => {
	const onSelect = jest.fn();
	const screen = await render(
		<SubjectAddFlow
			options={[]}
			onCancel={jest.fn()}
			onSelect={onSelect}
			onSavePermanent={async () => {
				throw new Error("[CONVEX M(personalSubjects:create)] Server Error");
			}}
		/>,
	);
	await act(() =>
		fireEvent.changeText(
			screen.getByLabelText("Name des Fachs"),
			"Französisch",
		),
	);
	await act(() =>
		fireEvent.press(screen.getByRole("button", { name: "Weiter" })),
	);
	await act(async () => {
		fireEvent.press(
			screen.getByRole("button", { name: "Dauerhaft hinzufügen" }),
		);
	});
	expect(onSelect).not.toHaveBeenCalled();
	expect(
		screen.getByText(
			"Das Fach konnte nicht gespeichert werden. Bitte versuche es erneut.",
		),
	).toBeOnTheScreen();
	expect(
		screen.getByRole("button", { name: "Dauerhaft hinzufügen" }),
	).toBeOnTheScreen();
});

test("corrects a common language typo before permanent confirmation", async () => {
	const onSavePermanent = jest.fn<(name: string) => Promise<SubjectSelection>>(
		async (name) => ({ name, personalSubjectId: "italian-id" as never }),
	);
	const screen = await render(
		<SubjectAddFlow
			options={[]}
			onCancel={jest.fn()}
			onSelect={jest.fn()}
			onSavePermanent={onSavePermanent}
		/>,
	);
	await act(() =>
		fireEvent.changeText(screen.getByLabelText("Name des Fachs"), "italienich"),
	);
	await act(() =>
		fireEvent.press(screen.getByRole("button", { name: "Weiter" })),
	);
	expect(screen.getByText(/Italienisch kann künftig/)).toBeOnTheScreen();
	await act(async () => {
		fireEvent.press(
			screen.getByRole("button", { name: "Dauerhaft hinzufügen" }),
		);
	});
	expect(onSavePermanent).toHaveBeenCalledWith("Italienisch");
});

test("settings mode offers only permanent saving and promotes timetable-only subjects", async () => {
	const onSelect = jest.fn();
	const onSavePermanent = jest.fn<(name: string) => Promise<SubjectSelection>>(
		async (name) => ({ name, personalSubjectId: "latin-id" as never }),
	);
	const screen = await render(
		<SubjectAddFlow
			permanentOnly
			options={[
				{
					...personalOption,
					kind: "timetable",
					name: "Latein",
					personalSubjectId: undefined,
				},
			]}
			onCancel={jest.fn()}
			onSelect={onSelect}
			onSavePermanent={onSavePermanent}
		/>,
	);
	await act(() =>
		fireEvent.changeText(screen.getByLabelText("Name des Fachs"), "Latein"),
	);
	await act(() =>
		fireEvent.press(screen.getByRole("button", { name: "Weiter" })),
	);
	expect(onSelect).not.toHaveBeenCalled();
	expect(
		screen.queryByRole("button", { name: "Nur diesmal verwenden" }),
	).toBeNull();
	await act(async () => {
		fireEvent.press(
			screen.getByRole("button", { name: "Dauerhaft hinzufügen" }),
		);
	});
	expect(onSavePermanent).toHaveBeenCalledWith("Latein");
	expect(onSelect).toHaveBeenCalledWith({
		name: "Latein",
		personalSubjectId: "latin-id",
	});
});
