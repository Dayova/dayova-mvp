import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { LearningRoutineCoach } from "./learning-routine-coach";

const mockMove = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockDismiss = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
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
	useQuery: (name: string) =>
		name === "home"
			? {
					behavioral: null,
					session: {
						id: "session",
						planId: "plan",
						title: "Mathe",
						startTime: "17:00",
						durationMinutes: 30,
						updatedAt: 7,
					},
				}
			: undefined,
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
		}: {
			visible: boolean;
			children: import("react").ReactNode;
			footer: import("react").ReactNode;
		}) =>
			visible ? React.createElement(Native.View, null, children, footer) : null,
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
	mockMove.mockReset();
	mockMove.mockResolvedValue(null);
	mockDismiss.mockReset();
	mockDismiss.mockResolvedValue(null);
	mockPush.mockReset();
});
test("home check-in does not force a dialog or change a schedule", async () => {
	const screen = await render(<LearningRoutineCoach referenceTime={1} />);
	expect(screen.getByText("Passt dir heute 17:00 Uhr?")).toBeOnTheScreen();
	expect(screen.queryByText("Nur heute übernehmen")).toBeNull();
	expect(mockMove).not.toHaveBeenCalled();
	await fireEvent.press(
		screen.getByRole("button", { name: "Heute nicht nachfragen" }),
	);
	expect(mockDismiss).toHaveBeenCalledWith({});
	expect(mockMove).not.toHaveBeenCalled();
});
test("earlier/later selection changes nothing until only-today consent", async () => {
	const screen = await render(<LearningRoutineCoach referenceTime={1} />);
	await fireEvent.press(screen.getByRole("button", { name: "Lieber später" }));
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
	const screen = await render(<LearningRoutineCoach referenceTime={1} />);
	await fireEvent.press(screen.getByRole("button", { name: "Lieber früher" }));
	await fireEvent.press(
		screen.getByRole("button", { name: "Testzeit wählen" }),
	);
	await fireEvent.press(
		screen.getByRole("button", { name: "Regelmäßige Zeiten einstellen" }),
	);
	expect(mockPush).toHaveBeenCalledWith("/learning-times");
	expect(mockMove).not.toHaveBeenCalled();
});
