import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { LearningRoutineCoach } from "./learning-routine-coach";

const mockMove = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockDismiss = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPush = jest.fn();
let mockFocused = true;
let mockOpenSheet = false;
const fixture = () => ({
	behavioral: null,
	session: {
		id: "session",
		planId: "plan",
		title: "Mathe",
		startTime: "17:00",
		durationMinutes: 30,
		updatedAt: 7,
	},
});
let mockRoutine: ReturnType<typeof fixture> | null = fixture();
const referenceTime = Date.parse("2026-09-28T10:00:00Z");
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
	useIsFocused: () => mockFocused,
	useFocusEffect: (callback: () => () => void) => {
		const React = jest.requireActual<typeof import("react")>("react");
		const focused = mockFocused;
		React.useEffect(
			() => (focused ? callback() : undefined),
			[callback, focused],
		);
	},
}));
jest.mock("~/components/ui/sheet-accessibility", () => ({
	useSheetAccessibility: () => ({ hasOpenSheet: mockOpenSheet }),
}));
jest.mock("~/components/ui/icon", () => ({
	ArrowLeft: () => null,
	Clock3: () => null,
}));
jest.mock("#convex/_generated/api", () => ({
	api: {
		learningTimes: {
			getHomeRoutine: "home",
			dismissHomeRoutine: "dismiss",
			respondToBehavioralSuggestion: "respond",
			previewBehavioralSuggestion: "preview",
			applyBehavioralSuggestion: "apply",
		},
		learningPlans: { moveSessionToday: "move" },
	},
}));
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useQuery: (name: string) => (name === "home" ? mockRoutine : undefined),
	useMutation: (name: string) => (name === "move" ? mockMove : mockDismiss),
}));
jest.mock("~/components/ui/dayova-sheet-frame", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		DayovaSheetFrame: ({
			visible,
			children,
			footer,
			title,
			description,
			onClose,
			onPresented,
			onDismiss,
		}: {
			visible: boolean;
			children: import("react").ReactNode;
			footer: import("react").ReactNode;
			title: string;
			description: string;
			onClose: () => void;
			onPresented?: () => void;
			onDismiss?: () => void;
		}) =>
			React.createElement(
				Native.View,
				{ testID: `sheet-${title}`, ...{ onPresented, onDismiss } },
				visible
					? React.createElement(
							Native.View,
							null,
							React.createElement(Native.Text, null, title),
							React.createElement(Native.Text, null, description),
							React.createElement(
								Native.Pressable,
								{
									accessibilityRole: "button",
									accessibilityLabel: "Popup schließen",
									onPress: onClose,
								},
								React.createElement(Native.Text, null, "X"),
							),
							children,
							footer,
						)
					: null,
			),
	};
});
jest.mock("~/components/ui/date-time-picker-sheet", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		DateTimePickerSheet: ({
			visible,
			onConfirm,
			onClose,
		}: {
			visible: boolean;
			onConfirm: (date: Date) => void;
			onClose: () => void;
		}) =>
			visible
				? React.createElement(
						Native.Pressable,
						{
							accessibilityRole: "button",
							accessibilityLabel: "Testzeit wählen",
							onPress: () => {
								const d = new Date();
								d.setHours(18, 0);
								onConfirm(d);
								onClose();
							},
						},
						React.createElement(Native.Text, null, "Testzeit wählen"),
					)
				: null,
	};
});
beforeEach(() => {
	jest.useFakeTimers();
	mockFocused = true;
	mockOpenSheet = false;
	mockRoutine = fixture();
	mockMove.mockReset();
	mockMove.mockResolvedValue(null);
	mockDismiss.mockReset();
	mockDismiss.mockResolvedValue(null);
	mockPush.mockReset();
});
afterEach(() => {
	jest.useRealTimers();
});
const title = "Passt dir heute 17:00 Uhr zum Lernen?";
const openPrompt = async () => {
	const screen = await render(
		<LearningRoutineCoach referenceTime={referenceTime} />,
	);
	await act(async () => {
		jest.advanceTimersByTime(400);
	});
	return screen;
};
const chooseOtherTime = async (
	screen: Awaited<ReturnType<typeof openPrompt>>,
) => {
	await fireEvent.press(screen.getByRole("button", { name: "Andere Uhrzeit" }));
	expect(screen.queryByRole("button", { name: "Testzeit wählen" })).toBeNull();
	await fireEvent(screen.getByTestId(`sheet-${title}`), "dismiss");
};
test("asks one short question with two actions and keeps the schedule unchanged", async () => {
	const screen = await openPrompt();
	expect(screen.getByText(title)).toBeOnTheScreen();
	expect(screen.getByText("Mathe · 30 Minuten")).toBeOnTheScreen();
	expect(screen.queryByText("Jetzt lernen")).toBeNull();
	expect(screen.queryByText("Lieber früher")).toBeNull();
	expect(screen.queryByText("Heute nicht nachfragen")).toBeNull();
	await fireEvent(screen.getByTestId(`sheet-${title}`), "presented");
	expect(mockDismiss).toHaveBeenCalledTimes(1);
	// The live query disappears after saving today's check-in; the sheet keeps its snapshot.
	mockRoutine = null;
	await screen.rerender(<LearningRoutineCoach referenceTime={referenceTime} />);
	expect(screen.getByText(title)).toBeOnTheScreen();
	await fireEvent.press(screen.getByRole("button", { name: "Ja, passt" }));
	expect(screen.queryByText(title)).toBeNull();
	expect(mockDismiss).toHaveBeenCalledTimes(1);
	expect(mockMove).not.toHaveBeenCalled();
	expect(mockPush).not.toHaveBeenCalled();
});
test("closing skips today without moving or starting the session and does not reopen", async () => {
	const screen = await openPrompt();
	await fireEvent.press(
		screen.getByRole("button", { name: "Popup schließen" }),
	);
	await act(async () => {
		jest.advanceTimersByTime(1000);
	});
	expect(screen.queryByText(title)).toBeNull();
	expect(mockDismiss).toHaveBeenCalledWith({});
	expect(mockMove).not.toHaveBeenCalled();
	expect(mockPush).not.toHaveBeenCalled();
});
test("time selection changes nothing until only-today consent", async () => {
	const screen = await openPrompt();
	await chooseOtherTime(screen);
	await fireEvent.press(
		screen.getByRole("button", { name: "Testzeit wählen" }),
	);
	expect(mockMove).not.toHaveBeenCalled();
	await fireEvent.press(
		screen.getByRole("button", { name: "Nur heute übernehmen" }),
	);
	expect(mockMove).toHaveBeenCalledWith({
		sessionId: "session",
		startTime: "18:00",
		expectedUpdatedAt: 7,
	});
});
test("regular changes open the settings instead of silently persisting the one-off choice", async () => {
	const screen = await openPrompt();
	await chooseOtherTime(screen);
	await fireEvent.press(
		screen.getByRole("button", { name: "Testzeit wählen" }),
	);
	await fireEvent.press(
		screen.getByRole("button", { name: "Regelmäßige Zeiten einstellen" }),
	);
	expect(mockPush).toHaveBeenCalledWith("/learning-times");
	expect(mockMove).not.toHaveBeenCalled();
});
test("waits for other sheets and for dashboard focus", async () => {
	mockOpenSheet = true;
	const screen = await openPrompt();
	expect(screen.queryByText(title)).toBeNull();
	mockOpenSheet = false;
	mockFocused = false;
	await screen.rerender(<LearningRoutineCoach referenceTime={referenceTime} />);
	await act(async () => {
		jest.advanceTimersByTime(500);
	});
	expect(screen.queryByText(title)).toBeNull();
	mockFocused = true;
	await screen.rerender(<LearningRoutineCoach referenceTime={referenceTime} />);
	await act(async () => {
		jest.advanceTimersByTime(400);
	});
	expect(screen.getByText(title)).toBeOnTheScreen();
});
test("does not ask for a past learning time or an absent routine", async () => {
	mockRoutine = {
		...fixture(),
		session: { ...fixture().session, startTime: "09:00" },
	};
	const screen = await openPrompt();
	expect(screen.queryByText("Ja, passt")).toBeNull();
	mockRoutine = null;
	await screen.rerender(<LearningRoutineCoach referenceTime={referenceTime} />);
	await act(async () => {
		jest.advanceTimersByTime(500);
	});
	expect(mockDismiss).not.toHaveBeenCalled();
});
test("failed daily persistence can be retried without changing a plan", async () => {
	mockDismiss.mockRejectedValueOnce(new Error("offline"));
	const screen = await openPrompt();
	await fireEvent(screen.getByTestId(`sheet-${title}`), "presented");
	expect(screen.getByRole("alert")).toBeOnTheScreen();
	await fireEvent.press(screen.getByRole("button", { name: "Ja, passt" }));
	expect(mockDismiss).toHaveBeenCalledTimes(2);
	expect(screen.queryByText(title)).toBeNull();
	expect(mockMove).not.toHaveBeenCalled();
});
test("leaving Today closes the prompt and returning does not show it twice", async () => {
	const screen = await openPrompt();
	await fireEvent(screen.getByTestId(`sheet-${title}`), "presented");
	mockFocused = false;
	await screen.rerender(<LearningRoutineCoach referenceTime={referenceTime} />);
	mockFocused = true;
	await screen.rerender(<LearningRoutineCoach referenceTime={referenceTime} />);
	await act(async () => {
		jest.advanceTimersByTime(1000);
	});
	expect(screen.queryByText(title)).toBeNull();
	expect(mockDismiss).toHaveBeenCalledTimes(1);
});
test("a new day permits a new check-in", async () => {
	const screen = await openPrompt();
	await fireEvent.press(screen.getByRole("button", { name: "Ja, passt" }));
	await screen.rerender(
		<LearningRoutineCoach referenceTime={referenceTime + 86400000} />,
	);
	await act(async () => {
		jest.advanceTimersByTime(400);
	});
	expect(screen.getByText(title)).toBeOnTheScreen();
});
