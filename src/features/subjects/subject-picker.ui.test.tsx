import { describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import {
	InlineSubjectPicker,
	SubjectAddFlow,
	SubjectPickerContent,
} from "./subject-picker";
import type { SubjectSelection } from "./use-subject-options";

jest.mock("~/components/ui/dayova-sheet-frame", () => ({
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
		accessibilityLiveRegion,
		accessibilityState,
		accessibilityLabel,
	}: {
		children: React.ReactNode;
		disabled?: boolean;
		onPress?: () => void;
		accessibilityLiveRegion?: "none" | "polite" | "assertive";
		accessibilityState?: { busy?: boolean; disabled?: boolean };
		accessibilityLabel?: string;
	}) => {
		const ReactNative =
			jest.requireActual<typeof import("react-native")>("react-native");
		return (
			<ReactNative.Pressable
				accessibilityRole="button"
				accessibilityLiveRegion={accessibilityLiveRegion}
				accessibilityState={accessibilityState}
				accessibilityLabel={accessibilityLabel}
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
			onPrimary: "#1A1A1A",
			primary: "#00BAFF",
			secondaryText: "#697586",
		},
	}),
}));

const mockCreateSubject =
	jest.fn<(args: { name: string }) => Promise<unknown>>();
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
	useQueries: () => ({
		subjects: new Error("[CONVEX Q(personalSubjects:list)] Server Error"),
	}),
	useMutation: () => mockCreateSubject,
}));
jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));

const personalOption = {
	key: "personal:french",
	name: "Französisch",
	personalSubjectId: "personal-french" as never,
	kind: "personal" as const,
	Icon: () => React.createElement("Icon"),
};

test("inline creation saves permanently and preserves the returned ID while the catalog is unavailable", async () => {
	mockCreateSubject.mockResolvedValueOnce({
		kind: "personal",
		id: "spanish-id",
		name: "Spanisch",
	});
	function SelectionProbe() {
		const [selected, setSelected] = React.useState<SubjectSelection>({
			name: "",
		});
		return <InlineSubjectPicker selected={selected} onSelect={setSelected} />;
	}
	const screen = await render(<SelectionProbe />);
	await fireEvent.press(
		screen.getByRole("button", { name: "Fach hinzufügen" }),
	);
	await fireEvent.changeText(
		screen.getByLabelText("Name des Fachs"),
		"Spanisch",
	);
	await fireEvent.press(
		screen.getAllByRole("button", { name: "Fach hinzufügen" })[1],
	);
	expect(mockCreateSubject).toHaveBeenCalledWith({ name: "Spanisch" });
	expect(screen.getByRole("radio", { name: "Spanisch" })).toBeChecked();
	expect(screen.queryByText("Nur für diesen Eintrag")).toBeNull();
	expect(screen.queryByText("Fach dauerhaft hinzufügen?")).toBeNull();
});

test("renders one continuous catalog without a personal-subject section", async () => {
	const onSelect = jest.fn();
	const screen = await render(
		<SubjectPickerContent
			options={[
				{
					...personalOption,
					key: "builtin:math",
					name: "Mathematik",
					kind: "builtIn",
					personalSubjectId: undefined,
				},
				personalOption,
			]}
			selected={{
				name: "Französisch",
				personalSubjectId: personalOption.personalSubjectId,
			}}
			isLoading={false}
			onSelect={onSelect}
			onAdd={jest.fn()}
		/>,
	);
	expect(screen.queryByText("Persönliche Fächer")).toBeNull();
	expect(
		screen.getAllByRole("radio").map((row) => row.props.accessibilityLabel),
	).toEqual(["Mathematik", "Französisch"]);
	expect(screen.getByRole("radio", { name: "Französisch" })).toBeChecked();
	await fireEvent.press(screen.getByRole("radio", { name: "Französisch" }));
	expect(onSelect).toHaveBeenCalledWith({
		name: "Französisch",
		personalSubjectId: personalOption.personalSubjectId,
	});
});

test("a newly saved subject stays selected before and after the reactive catalog catches up", async () => {
	const props = {
		selected: {
			name: "Französisch",
			personalSubjectId: personalOption.personalSubjectId,
		},
		isLoading: false,
		onSelect: jest.fn(),
		onAdd: jest.fn(),
	};
	const screen = await render(
		<SubjectPickerContent
			{...props}
			options={[
				{ ...personalOption, kind: "timetable", personalSubjectId: undefined },
			]}
		/>,
	);
	expect(screen.getAllByRole("radio", { name: "Französisch" })).toHaveLength(1);
	expect(screen.getByRole("radio", { name: "Französisch" })).toBeChecked();
	await screen.rerender(
		<SubjectPickerContent {...props} options={[personalOption]} />,
	);
	expect(screen.getAllByRole("radio", { name: "Französisch" })).toHaveLength(1);
	expect(screen.getByRole("radio", { name: "Französisch" })).toBeChecked();
});

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
			fireEvent.press(screen.getByRole("button", { name: "Fach hinzufügen" })),
		);

		expect(onSelect).toHaveBeenCalledWith({
			name: "Französisch",
			personalSubjectId: "personal-french",
		});
		expect(onSavePermanent).not.toHaveBeenCalled();
	});

	test("saves a new subject immediately without a permanence choice", async () => {
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
			fireEvent.press(screen.getByRole("button", { name: "Fach hinzufügen" })),
		);
		expect(screen.queryByText("Fach dauerhaft hinzufügen?")).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Nur diesmal verwenden" }),
		).toBeNull();

		await waitFor(() => expect(onSavePermanent).toHaveBeenCalledWith("Latein"));
		expect(onSelect).toHaveBeenCalledWith(savedSelection);
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
		fireEvent.press(screen.getByRole("button", { name: "Fach hinzufügen" })),
	);
	expect(onSelect).not.toHaveBeenCalled();
	expect(
		screen.getByText(
			"Das Fach konnte nicht gespeichert werden. Bitte versuche es erneut.",
		),
	).toBeOnTheScreen();
	expect(
		screen.getByRole("button", { name: "Fach hinzufügen" }),
	).toBeOnTheScreen();
});

test("corrects a common language typo before saving", async () => {
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
		fireEvent.press(screen.getByRole("button", { name: "Fach hinzufügen" })),
	);
	expect(onSavePermanent).toHaveBeenCalledWith("Italienisch");
});

test("settings mode offers only permanent saving and promotes timetable-only subjects", async () => {
	const onSelect = jest.fn();
	const onSavePermanent = jest.fn<(name: string) => Promise<SubjectSelection>>(
		async (name) => ({ name, personalSubjectId: "latin-id" as never }),
	);
	const screen = await render(
		<SubjectAddFlow
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
	expect(
		screen.queryByRole("button", { name: "Nur diesmal verwenden" }),
	).toBeNull();
	await act(async () => {
		fireEvent.press(screen.getByRole("button", { name: "Fach hinzufügen" }));
	});
	expect(onSavePermanent).toHaveBeenCalledWith("Latein");
	expect(onSelect).toHaveBeenCalledWith({
		name: "Latein",
		personalSubjectId: "latin-id",
	});
});

test("settings direct save keeps errors and typed text, then allows retry", async () => {
	const onSelect = jest.fn();
	const onSavePermanent = jest
		.fn<(name: string) => Promise<SubjectSelection>>()
		.mockRejectedValueOnce(
			new Error("[CONVEX M(personalSubjects:create)] Server Error"),
		)
		.mockResolvedValueOnce({ name: "Italienisch" });
	const screen = await render(
		<SubjectAddFlow
			options={[]}
			onCancel={jest.fn()}
			onSelect={onSelect}
			onSavePermanent={onSavePermanent}
		/>,
	);
	await act(() =>
		fireEvent.changeText(
			screen.getByLabelText("Name des Fachs"),
			"Italienisch",
		),
	);
	await act(async () =>
		fireEvent.press(screen.getByRole("button", { name: "Fach hinzufügen" })),
	);
	expect(onSelect).not.toHaveBeenCalled();
	expect(screen.getByLabelText("Name des Fachs")).toHaveProp(
		"value",
		"Italienisch",
	);
	expect(
		screen.getByText(
			"Das Fach konnte nicht gespeichert werden. Bitte versuche es erneut.",
		),
	).toBeOnTheScreen();
	await act(async () =>
		fireEvent.press(screen.getByRole("button", { name: "Fach hinzufügen" })),
	);
	expect(onSelect).toHaveBeenCalledWith({ name: "Italienisch" });
});

test("settings blocks duplicate submits and cancellation during a pending save", async () => {
	let resolveSave!: (value: SubjectSelection) => void;
	const onSavePermanent = jest.fn<(name: string) => Promise<SubjectSelection>>(
		() =>
			new Promise((resolve) => {
				resolveSave = resolve;
			}),
	);
	const onCancel = jest.fn();
	const screen = await render(
		<SubjectAddFlow
			options={[]}
			onCancel={onCancel}
			onSelect={jest.fn()}
			onSavePermanent={onSavePermanent}
		/>,
	);
	await act(() =>
		fireEvent.changeText(
			screen.getByLabelText("Name des Fachs"),
			"Italienisch",
		),
	);
	await act(async () => {
		await fireEvent(screen.getByLabelText("Name des Fachs"), "submitEditing");
		await fireEvent(screen.getByLabelText("Name des Fachs"), "submitEditing");
	});
	expect(onSavePermanent).toHaveBeenCalledTimes(1);
	expect(screen.getByRole("button", { name: "Wird gespeichert …" })).toHaveProp(
		"accessibilityLiveRegion",
		"polite",
	);
	expect(
		screen.getByRole("progressbar", { name: "Fach wird gespeichert" }),
	).toBeOnTheScreen();
	await act(() =>
		fireEvent.press(screen.getByRole("button", { name: "Abbrechen" })),
	);
	expect(onCancel).not.toHaveBeenCalled();
	await act(async () => resolveSave({ name: "Italienisch" }));
});

jest.mock("react-native-reanimated", () =>
	jest.requireActual("../../../tests/mocks/selection-reanimated.cjs"),
);
