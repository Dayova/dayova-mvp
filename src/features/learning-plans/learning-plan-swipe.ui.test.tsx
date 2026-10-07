import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import LearningPlansScreen from "~/app/(app)/learning-plans";

const mockPush = jest.fn();
const mockRemove = jest.fn();
type GestureCallbacks = Record<
	string,
	(event?: { translationX: number; translationY?: number }) => void
>;
let mockPan: GestureCallbacks;
let mockSpringInFlight = false;

jest.mock(
	"~/components/ui/icon",
	() => new Proxy({}, { get: () => () => null }),
);

jest.mock("expo-router", () => ({
	router: { push: (...args: unknown[]) => mockPush(...args) },
	useLocalSearchParams: () => ({}),
}));
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useMutation: () => mockRemove,
	useQuery: (query: unknown) => {
		const { getFunctionName } =
			jest.requireActual<typeof import("convex/server")>("convex/server");
		return getFunctionName(query as Parameters<typeof getFunctionName>[0]) ===
			"learningPlans:listOverview"
			? [
					{
						id: "plan-1",
						subject: "Mathematik",
						examTypeLabel: "Klassenarbeit",
						topicDescription: "Funktionen",
						status: "accepted",
						needsSchoolMaterial: false,
						progressPercent: 0,
						examDateKey: "2026-10-10",
						examDateLabel: "10. Oktober",
					},
				]
			: [];
	},
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { id: "learner" } }),
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { border: "#ddd", secondaryText: "#666", surface: "#fff" },
	}),
}));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("react-native-screens/experimental", () => ({
	SafeAreaView:
		jest.requireActual<typeof import("react-native")>("react-native").View,
}));
jest.mock("~/components/create-type-picker-modal", () => ({
	CreateTypePickerModal: () => null,
}));
jest.mock("~/features/learning-plans/material-required-sheet", () => ({
	MaterialRequiredSheet: () => null,
}));
jest.mock("~/components/ui/themed-status-bar", () => ({
	ThemedStatusBar: () => null,
}));
jest.mock("~/components/ui/confirmation-sheet", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { Text } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		ConfirmationSheet: ({
			visible,
			description,
		}: {
			visible: boolean;
			description: string;
		}) => (visible ? React.createElement(Text, null, description) : null),
	};
});
jest.mock("react-native-worklets", () => ({
	scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
		fn(...args),
}));
jest.mock("react-native-reanimated", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: { View },
		Easing: { out: (x: unknown) => x, cubic: 0 },
		interpolate: () => 1,
		useAnimatedStyle: (fn: () => unknown) => fn(),
		useSharedValue: (initial: unknown) =>
			React.useRef({
				value: initial,
				get() {
					return this.value;
				},
				set(value: unknown) {
					this.value = value;
				},
			}).current,
		withTiming: (value: unknown) => value,
		withSpring: (
			value: unknown,
			_config: unknown,
			finished?: (done: boolean) => void,
		) => {
			if (!mockSpringInFlight) finished?.(true);
			return mockSpringInFlight ? -20 : value;
		},
	};
});
jest.mock("react-native-gesture-handler", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		Gesture: {
			Pan: () => {
				const callbacks: GestureCallbacks = {};
				const gesture = new Proxy(callbacks, {
					get: (_, key: string) =>
						key === "callbacks"
							? callbacks
							: (value: GestureCallbacks[string]) => {
									if (key.startsWith("on")) callbacks[key] = value;
									return gesture;
								},
				});
				return gesture;
			},
		},
		GestureDetector: ({
			gesture,
			children,
		}: {
			gesture: GestureCallbacks;
			children: import("react").ReactNode;
		}) => {
			mockPan = gesture.callbacks as unknown as GestureCallbacks;
			return React.createElement(React.Fragment, null, children);
		},
	};
});

// Replay native pan callbacks, then the trailing RN Pressable event that must
// never navigate. Native recognizer arbitration itself still needs a device.
async function swipe(distance: number) {
	await act(() => {
		mockPan.onBegin?.();
		mockPan.onStart?.();
		mockPan.onUpdate?.({ translationX: distance });
		mockPan.onEnd?.();
		mockPan.onFinalize?.({ translationX: distance, translationY: 0 });
	});
}

beforeEach(() => {
	mockPush.mockClear();
	mockRemove.mockClear();
	mockSpringInFlight = false;
});

describe("learning plan swipe navigation", () => {
	test("opens a closed card on an ordinary tap", async () => {
		const screen = await render(<LearningPlansScreen />);
		await act(() => {
			mockPan.onBegin?.();
			mockPan.onFinalize?.({ translationX: 0, translationY: 0 });
		});
		await fireEvent.press(screen.getByRole("button", { name: /^Mathematik,/ }));
		expect(mockPush).toHaveBeenCalledTimes(1);
	});

	test.each([
		-80, -20,
	])("does not open the plan after a %s-point swipe", async (distance) => {
		const screen = await render(<LearningPlansScreen />);
		await swipe(distance);
		await fireEvent.press(screen.getByRole("button", { name: /^Mathematik,/ }));
		expect(mockPush).not.toHaveBeenCalled();
	});

	test("keeps edit and delete hidden for a touch that never becomes a swipe", async () => {
		const screen = await render(<LearningPlansScreen />);
		await act(() => {
			mockPan.onBegin?.();
			mockPan.onFinalize?.({ translationX: 0, translationY: 0 });
		});
		expect(
			screen.queryByRole("button", { name: "Lernplan bearbeiten" }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Lernplan löschen" }),
		).toBeNull();
	});

	test("allows a fresh tap after a short swipe snaps closed", async () => {
		const screen = await render(<LearningPlansScreen />);
		await swipe(-20);
		await fireEvent.press(screen.getByRole("button", { name: /^Mathematik,/ }));
		await act(() => {
			mockPan.onBegin?.();
			mockPan.onFinalize?.({ translationX: 0, translationY: 0 });
		});
		await fireEvent.press(screen.getByRole("button", { name: /^Mathematik,/ }));
		expect(mockPush).toHaveBeenCalledTimes(1);
	});

	test("closes revealed actions on a fresh tap before allowing navigation", async () => {
		const screen = await render(<LearningPlansScreen />);
		await swipe(-80);
		await act(() => {
			mockPan.onBegin?.();
			mockPan.onFinalize?.({ translationX: 0, translationY: 0 });
		});
		await fireEvent.press(screen.getByRole("button", { name: /^Mathematik,/ }));
		expect(mockPush).not.toHaveBeenCalled();
		expect(
			screen.queryByRole("button", { name: "Lernplan bearbeiten" }),
		).toBeNull();
		await act(() => {
			mockPan.onBegin?.();
			mockPan.onFinalize?.({ translationX: 0, translationY: 0 });
		});
		await fireEvent.press(screen.getByRole("button", { name: /^Mathematik,/ }));
		expect(mockPush).toHaveBeenCalledTimes(1);
	});

	test("does not navigate when swiping the revealed actions closed", async () => {
		const screen = await render(<LearningPlansScreen />);
		await swipe(-80);
		await swipe(104);
		await fireEvent.press(screen.getByRole("button", { name: /^Mathematik,/ }));
		expect(mockPush).not.toHaveBeenCalled();
	});

	test.each([
		0, -20,
	])("does not open after a vertical drag fails the horizontal pan (%s-point X movement)", async (translationX) => {
		const screen = await render(<LearningPlansScreen />);
		await act(() => {
			mockPan.onBegin?.();
			mockPan.onFinalize?.({ translationX, translationY: -100 });
		});
		await fireEvent.press(screen.getByRole("button", { name: /^Mathematik,/ }));
		expect(mockPush).not.toHaveBeenCalled();
		expect(
			screen.queryByRole("button", { name: "Lernplan bearbeiten" }),
		).toBeNull();
	});

	test("opens on a fresh tap while a short swipe is still snapping back", async () => {
		const screen = await render(<LearningPlansScreen />);
		mockSpringInFlight = true;
		await swipe(-20);
		await fireEvent.press(screen.getByRole("button", { name: /^Mathematik,/ }));
		expect(mockPush).not.toHaveBeenCalled();
		await act(() => {
			mockPan.onBegin?.();
			mockPan.onFinalize?.({ translationX: 0, translationY: 0 });
		});
		await fireEvent.press(screen.getByRole("button", { name: /^Mathematik,/ }));
		expect(mockPush).toHaveBeenCalledTimes(1);
	});

	test("accessibility activation opens after a short swipe without a new touch", async () => {
		const screen = await render(<LearningPlansScreen />);
		await swipe(-20);
		const card = screen.getByRole("button", { name: /^Mathematik,/ });
		await fireEvent(card, "accessibilityAction", {
			nativeEvent: { actionName: "activate" },
		});
		expect(mockPush).toHaveBeenCalledTimes(1);
	});

	test("accessibility activation closes open actions before opening the plan", async () => {
		const screen = await render(<LearningPlansScreen />);
		await swipe(-80);
		const card = screen.getByRole("button", { name: /^Mathematik,/ });
		await fireEvent(card, "accessibilityAction", {
			nativeEvent: { actionName: "activate" },
		});
		expect(mockPush).not.toHaveBeenCalled();
		expect(
			screen.queryByRole("button", { name: "Lernplan bearbeiten" }),
		).toBeNull();
		await fireEvent(card, "accessibilityAction", {
			nativeEvent: { actionName: "activate" },
		});
		expect(mockPush).toHaveBeenCalledTimes(1);
	});

	test("editing a revealed card only opens the editor", async () => {
		const screen = await render(<LearningPlansScreen />);
		await swipe(-80);
		await fireEvent.press(screen.getByRole("button", { name: /^Mathematik,/ }));
		await fireEvent.press(
			screen.getByRole("button", { name: "Lernplan bearbeiten" }),
		);
		expect(mockPush).toHaveBeenCalledTimes(1);
		expect(mockPush).toHaveBeenCalledWith(
			"/learning-plans/new?learningPlanId=plan-1&mode=edit",
		);
	});

	test("deleting a revealed card asks for confirmation without opening the plan", async () => {
		const screen = await render(<LearningPlansScreen />);
		await swipe(-80);
		await fireEvent.press(screen.getByRole("button", { name: /^Mathematik,/ }));
		await fireEvent.press(
			screen.getByRole("button", { name: "Lernplan löschen" }),
		);
		expect(
			screen.getByText("Möchtest du den Lernplan Mathematik wirklich löschen?"),
		).toBeOnTheScreen();
		expect(mockPush).not.toHaveBeenCalled();
		expect(mockRemove).not.toHaveBeenCalled();
	});
});
