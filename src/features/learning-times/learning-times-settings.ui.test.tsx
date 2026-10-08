import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import LearningTimesOverviewScreen from "~/app/learning-times";
import { LearningTimeEditorSheet } from "./learning-time-editor-sheet";
import { WeeklyLearningTimes } from "./weekly-learning-times";

const monday = {
	id: "monday",
	dayOfWeek: 1,
	startTime: "16:00",
	endTime: "20:30",
};
const tuesday = {
	id: "tuesday",
	dayOfWeek: 2,
	startTime: "17:00",
	endTime: "17:30",
};
let mockEntries: (typeof monday)[] | undefined;
let mockAuthenticated = true;
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSave = jest.fn<() => Promise<void>>();
const mockRemove = jest.fn<(args: { id: string }) => Promise<void>>();
const mockTrackFeature = jest.fn();
const mockSwipeClose = jest.fn();
let mockEditorDismiss: (() => void) | undefined;
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: function MockSwipeable({
			children,
			renderRightActions,
			enabled,
		}: {
			children: ReactNode;
			enabled: boolean;
			renderRightActions: (
				progress: undefined,
				translation: undefined,
				methods: { close: () => void },
			) => ReactNode;
		}) {
			const [open, setOpen] = React.useState(false);
			return React.createElement(
				View,
				{
					testID: "swipe-row",
					// Test seam for opening actions; this does not simulate native gestures.
					onTouchEnd: () => {
						if (enabled) setOpen(true);
					},
				},
				children,
				open
					? renderRightActions(undefined, undefined, {
							close: () => {
								mockSwipeClose();
								setOpen(false);
							},
						})
					: null,
			);
		},
	};
});

async function requestDelete(
	screen: Awaited<ReturnType<typeof render>>,
	label: string,
) {
	await fireEvent(
		screen.getByRole("button", { name: `${label} bearbeiten` }),
		"accessibilityAction",
		{ nativeEvent: { actionName: "delete" } },
	);
}
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("convex/react", () => ({
	useQuery: () => mockEntries,
	useConvexAuth: () => ({ isAuthenticated: mockAuthenticated }),
	useMutation: (reference: unknown) => {
		const { getFunctionName } =
			jest.requireActual<typeof import("convex/server")>("convex/server");
		return getFunctionName(
			reference as Parameters<typeof getFunctionName>[0],
		).endsWith("upsertMine")
			? mockSave
			: mockRemove;
	},
}));
jest.mock("expo-router", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: mockReplace,
		canGoBack: () => false,
	}),
	useLocalSearchParams: () => ({ returnTo: "/learning-plans" }),
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { id: "test" } }),
}));
jest.mock("~/lib/use-feature-analytics", () => ({
	useFeatureAnalytics: () => mockTrackFeature,
}));
jest.mock("~/components/ui/keyboard-safe-scroll-view", () => {
	const { ScrollView } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return { KeyboardSafeScrollView: ScrollView };
});
jest.mock("~/components/ui/date-time-picker-sheet", () => ({
	DateTimePickerSheet: ({
		visible,
		onChange,
		onClose,
	}: {
		visible: boolean;
		onChange: (event: { type: "set" }, value: Date) => void;
		onClose: () => void;
	}) => {
		const { Pressable, Text } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return visible ? (
			<>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Set time 18:45"
					onPress={() =>
						onChange({ type: "set" }, new Date(2026, 9, 2, 18, 45))
					}
				/>
				<Pressable accessibilityRole="button" onPress={onClose}>
					<Text>Fertig</Text>
				</Pressable>
			</>
		) : null;
	},
}));
jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetFrame: function MockSheet({
		visible,
		children,
		dismissDurationMs,
		footer,
		title,
		onClose,
		onDismiss,
		closeAccessibilityLabel,
		dismissible = true,
	}: {
		visible: boolean;
		children: ReactNode;
		dismissDurationMs?: number;
		footer: ReactNode;
		title?: string;
		onClose: () => void;
		onDismiss?: () => void;
		closeAccessibilityLabel?: string;
		dismissible?: boolean;
	}) {
		if (title === "Lernzeit bearbeiten") mockEditorDismiss = onDismiss;
		const { Pressable, Text } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return visible ? (
			<>
				<Text>{title}</Text>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={closeAccessibilityLabel}
					disabled={!dismissible}
					onPress={onClose}
				/>
				{children}
				{footer}
			</>
		) : onDismiss ? (
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Native dismissal completed"
				testID={`dismiss-duration-${dismissDurationMs ?? "default"}`}
				onPress={onDismiss}
			/>
		) : null;
	},
}));
jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return new Proxy(
		{},
		{
			get: (_, name) => (props: object) =>
				React.createElement("Icon", { ...props, testID: String(name) }),
		},
	);
});
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: jest.requireActual<typeof import("~/lib/design-system")>(
			"~/lib/design-system",
		).DAYOVA_DESIGN_SYSTEM.colors,
	}),
}));

describe("learning times settings", () => {
	test("honors a picker request when native dismissal uses the presented callback", async () => {
		const onClose = jest.fn();
		const screen = await render(
			<LearningTimeEditorSheet day={2} id="tuesday" onClose={onClose} />,
		);
		const presentedDismiss = mockEditorDismiss;
		await fireEvent.press(
			screen.getByRole("button", { name: "Beginn: 17:00" }),
		);
		await act(() => presentedDismiss?.());
		expect(onClose).not.toHaveBeenCalled();
		expect(screen.getByText("Fertig")).toBeTruthy();
	});
	test("waits for editor dismissal, preserves the draft and returns from the time picker", async () => {
		const onClose = jest.fn();
		const screen = await render(
			<LearningTimeEditorSheet day={2} id="tuesday" onClose={onClose} />,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Ende: 17:30" }));
		expect(screen.getByTestId("dismiss-duration-120")).toBeTruthy();
		expect(screen.queryByText("Fertig")).toBeNull();
		await fireEvent.press(
			screen.getByRole("button", { name: "Native dismissal completed" }),
		);
		expect(onClose).not.toHaveBeenCalled();
		await fireEvent.press(
			screen.getByRole("button", { name: "Set time 18:45" }),
		);
		await fireEvent.press(screen.getByText("Fertig"));
		expect(screen.getByRole("button", { name: "Ende: 18:45" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Beginn: 17:00" })).toBeTruthy();
		await fireEvent.press(screen.getByText("Speichern"));
		expect(mockSave).toHaveBeenCalledWith({
			id: "tuesday",
			dayOfWeek: 2,
			startTime: "17:00",
			endTime: "18:45",
		});
	});
	beforeEach(() => {
		mockEntries = [tuesday, monday];
		mockAuthenticated = true;
		mockPush.mockReset();
		mockReplace.mockReset();
		mockSave.mockReset();
		mockSave.mockResolvedValue(undefined);
		mockSwipeClose.mockReset();
		mockRemove.mockReset();
		mockRemove.mockResolvedValue(undefined);
		mockTrackFeature.mockReset();
	});
	test("lists existing times in weekday order with independent edit and delete actions", async () => {
		const onEdit = jest.fn();
		const onRemove = jest.fn();
		const screen = await render(
			<WeeklyLearningTimes
				entries={[tuesday, monday]}
				onAdd={jest.fn()}
				onEdit={onEdit}
				onRemove={onRemove}
			/>,
		);
		expect(
			screen
				.getAllByRole("button")
				.map((node) => node.props.accessibilityLabel),
		).toEqual([
			"Montag, 16:00 bis 20:30 bearbeiten",
			"Dienstag, 17:00 bis 17:30 bearbeiten",
		]);
		expect(screen.queryByText("Mittwoch")).toBeNull();
		expect(screen.getByText("Mo")).toBeOnTheScreen();
		expect(screen.getByText("Di")).toBeOnTheScreen();
		expect(screen.queryByTestId("Trash2")).toBeNull();
		expect(screen.queryByTestId("Clock3")).toBeNull();
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Montag, 16:00 bis 20:30 bearbeiten",
			}),
		);
		expect(onEdit).toHaveBeenCalledWith(monday);
		await fireEvent(screen.getAllByTestId("swipe-row")[1], "touchEnd");
		await fireEvent.press(
			screen.getByRole("button", { name: "Dienstag, 17:00 bis 17:30 löschen" }),
		);
		expect(onRemove).toHaveBeenCalledWith(tuesday);
		expect(mockSwipeClose).toHaveBeenCalledTimes(1);
		expect(
			screen.queryByRole("button", {
				name: "Dienstag, 17:00 bis 17:30 löschen",
			}),
		).toBeNull();
	});
	test("offers an actionable empty state", async () => {
		const onAdd = jest.fn();
		const screen = await render(
			<WeeklyLearningTimes
				entries={[]}
				onAdd={onAdd}
				onEdit={jest.fn()}
				onRemove={jest.fn()}
			/>,
		);
		expect(
			screen.getByRole("header", { name: "Noch keine Lernzeiten" }),
		).toBeOnTheScreen();
		await fireEvent.press(
			screen.getByRole("button", { name: "Lernzeit hinzufügen" }),
		);
		expect(onAdd).toHaveBeenCalledWith(1);
	});
	test("waits for loading and authentication before enabling changes", async () => {
		mockEntries = undefined;
		const screen = await render(<LearningTimesOverviewScreen />);
		expect(
			screen.getByRole("progressbar", { name: "Lernzeiten werden geladen" }),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Lernzeit hinzufügen" }),
		).toBeDisabled();
		mockEntries = [monday];
		mockAuthenticated = false;
		await screen.rerender(<LearningTimesOverviewScreen />);
		expect(
			screen.getByRole("button", {
				name: "Montag, 16:00 bis 20:30 bearbeiten",
			}),
		).toBeDisabled();
		await requestDelete(screen, "Montag, 16:00 bis 20:30");
		expect(screen.queryByText("Lernzeit löschen?")).toBeNull();
		await fireEvent(screen.getAllByTestId("swipe-row")[0], "touchEnd");
		expect(
			screen.queryByRole("button", { name: "Montag, 16:00 bis 20:30 löschen" }),
		).toBeNull();
	});
	test("opens the add sheet in place and preserves the overview return target", async () => {
		const screen = await render(<LearningTimesOverviewScreen />);
		await fireEvent.press(
			screen.getByRole("button", { name: "Lernzeit hinzufügen" }),
		);
		expect(screen.getByText("Mittwoch")).toBeOnTheScreen();
		for (const label of ["Abbrechen", "Hinzufügen"]) {
			const action = screen.getByRole("button", { name: label });
			expect(action.props.className).toContain("min-h-14");
			expect(action.props.className).toContain("flex-1");
		}
		expect(mockPush).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("button", { name: "Abbrechen" }));
		await fireEvent.press(
			screen.getByRole("button", { name: "Native dismissal completed" }),
		);
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Montag, 16:00 bis 20:30 bearbeiten",
			}),
		);
		expect(screen.getByText("Lernzeit bearbeiten")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Speichern" }));
		await fireEvent.press(
			screen.getByRole("button", { name: "Native dismissal completed" }),
		);
		await fireEvent.press(screen.getByRole("button", { name: "Zurück" }));
		expect(mockReplace).toHaveBeenCalledWith("/learning-plans");
	});

	test("editor switches to confirmation without dismissing its sheet", async () => {
		const onClose = jest.fn();
		const screen = await render(
			<LearningTimeEditorSheet day={1} id="monday" onClose={onClose} />,
		);
		await fireEvent.press(screen.getByRole("radio", { name: "Mittwoch" }));
		await fireEvent.press(screen.getByRole("button", { name: "Löschen" }));
		expect(screen.getByText("Lernzeit löschen?")).toBeOnTheScreen();
		expect(mockRemove).not.toHaveBeenCalled();
		expect(
			screen.queryByRole("button", { name: "Native dismissal completed" }),
		).toBeNull();
		expect(screen.getByText(/Montag, 16:00–20:30/)).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Löschen" }));
		expect(mockRemove).toHaveBeenCalledWith({ id: "monday" });
		expect(mockTrackFeature.mock.calls).toEqual([
			["learning_times.remove", "attempted"],
			["learning_times.remove", "succeeded"],
		]);
		expect(onClose).not.toHaveBeenCalled();
		await fireEvent.press(
			screen.getByRole("button", { name: "Native dismissal completed" }),
		);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	test("editor saves the existing long time range and retains errors for retry", async () => {
		mockSave.mockRejectedValueOnce(new Error("offline"));
		const onClose = jest.fn();
		const screen = await render(
			<LearningTimeEditorSheet day={1} id="monday" onClose={onClose} />,
		);
		await fireEvent.press(screen.getByRole("radio", { name: "Mittwoch" }));
		await fireEvent.press(screen.getByRole("button", { name: "Speichern" }));
		expect(screen.getByText("offline")).toBeOnTheScreen();
		expect(onClose).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("button", { name: "Speichern" }));
		expect(mockSave).toHaveBeenLastCalledWith({
			id: "monday",
			dayOfWeek: 3,
			startTime: "16:00",
			endTime: "20:30",
		});
		expect(mockTrackFeature.mock.calls).toEqual([
			["learning_times.save", "attempted"],
			["learning_times.save", "failed"],
			["learning_times.save", "attempted"],
			["learning_times.save", "succeeded"],
		]);
		await fireEvent.press(
			screen.getByRole("button", { name: "Native dismissal completed" }),
		);
		expect(onClose).toHaveBeenCalledTimes(1);
	});
	test("does not delete before confirmation and permits cancellation", async () => {
		const screen = await render(<LearningTimesOverviewScreen />);
		await requestDelete(screen, "Montag, 16:00 bis 20:30");
		expect(mockRemove).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("button", { name: "Abbrechen" }));
		expect(screen.queryByRole("button", { name: "Löschen" })).toBeNull();
		expect(mockRemove).not.toHaveBeenCalled();
	});
	test("removes only the confirmed entry and prevents duplicate submissions", async () => {
		let finish: () => void = () => {};
		mockRemove.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		);
		const screen = await render(<LearningTimesOverviewScreen />);
		await requestDelete(screen, "Montag, 16:00 bis 20:30");
		await fireEvent.press(screen.getByRole("button", { name: "Löschen" }));
		expect(
			screen.getByRole("button", { name: "Löschen, wird ausgeführt" }),
		).toBeDisabled();
		expect(screen.getByRole("button", { name: "Abbrechen" })).toBeDisabled();
		expect(mockRemove).toHaveBeenCalledTimes(1);
		expect(mockRemove).toHaveBeenCalledWith({ id: "monday" });
		await act(async () => finish());
		expect(mockTrackFeature.mock.calls).toEqual([
			["learning_times.remove", "attempted"],
			["learning_times.remove", "succeeded"],
		]);
		expect(screen.queryByRole("button", { name: "Löschen" })).toBeNull();
	});
	test("retains the confirmation when deletion fails and allows retry", async () => {
		mockRemove.mockRejectedValueOnce(new Error("offline"));
		const screen = await render(<LearningTimesOverviewScreen />);
		await requestDelete(screen, "Montag, 16:00 bis 20:30");
		await fireEvent.press(screen.getByRole("button", { name: "Löschen" }));
		expect(screen.getByRole("button", { name: "Löschen" })).toBeEnabled();
		expect(screen.getByText("Das hat nicht geklappt")).toBeOnTheScreen();
		expect(screen.getByText("offline")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Löschen" }));
		expect(mockRemove).toHaveBeenCalledTimes(2);
	});
});
