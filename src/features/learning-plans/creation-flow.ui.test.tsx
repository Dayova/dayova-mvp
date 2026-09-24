import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import NewEntryScreen from "~/app/(creation)/entry/new";
import NewLearningPlanScreen from "~/app/(creation)/learning-plans/new";

let mockParams: Record<string, string> = {};
let mockProgress: { currentStep: number; onBack: () => void };
const mockRouter = {
	replace: jest.fn(),
	push: jest.fn(),
	dismissTo: jest.fn(),
	setParams: jest.fn(),
	back: jest.fn(),
	canGoBack: () => true,
};
const mockCreateEntry = jest.fn<() => Promise<string>>();
const mockUpdateEntry = jest.fn<() => Promise<void>>();
const mockCapture = jest.fn();
const mockAvailability = { status: "available" };
let mockSnapshot:
	| { plan: { topicDescription: string }; documents: never[] }
	| undefined;
let mockPauseVisible = false;
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useQueries: () => ({
		subjects: { personal: [], reusableTimetableSubjects: [] },
	}),
	useConvex: () => ({ query: async () => mockAvailability }),
	useQuery: (_reference: unknown, args: unknown) =>
		args === "skip"
			? undefined
			: args && typeof args === "object" && "id" in args
				? mockSnapshot
				: mockAvailability,
	useMutation: (reference: unknown) => {
		const { getFunctionName } =
			jest.requireActual<typeof import("convex/server")>("convex/server");
		return getFunctionName(
			reference as Parameters<typeof getFunctionName>[0],
		) === "dayEntries:create"
			? mockCreateEntry
			: mockUpdateEntry;
	},
	useAction: () => jest.fn(),
}));
jest.mock("expo-router", () => ({
	useRouter: () => mockRouter,
	useLocalSearchParams: () => mockParams,
	Stack: { Screen: () => null },
}));
jest.mock("~/features/learning-plans/creation-progress-shell", () => ({
	useLearningPlanCreationProgress: (configuration: typeof mockProgress) => {
		mockProgress = configuration;
	},
}));
jest.mock("~/lib/navigation", () => ({
	...jest.requireActual<typeof import("~/lib/navigation-actions")>(
		"~/lib/navigation-actions",
	),
	useBackIntent: () => undefined,
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { id: "user" } }),
}));
jest.mock("~/lib/use-validation-analytics", () => ({
	useValidationAnalytics: () => ({ capture: mockCapture }),
}));
jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));
jest.mock("~/lib/analytics", () => ({
	getValidationFileSizeBucket: jest.fn(),
}));
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));
jest.mock("expo-file-system", () => ({ File: jest.fn() }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-image-picker", () => ({}));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("react-native-keyboard-controller", () => ({
	KeyboardStickyView:
		jest.requireActual<typeof import("react-native")>("react-native").View,
}));
jest.mock("react-native-reanimated", () => ({
	__esModule: true,
	default: {
		View: jest.requireActual<typeof import("react-native")>("react-native")
			.View,
	},
	FadeIn: { duration: () => undefined },
	FadeInDown: { duration: () => undefined },
	LinearTransition: { duration: () => undefined },
}));
jest.mock("~/components/ui/keyboard-safe-scroll-view", () => ({
	KeyboardSafeScrollView:
		jest.requireActual<typeof import("react-native")>("react-native")
			.ScrollView,
}));
jest.mock("~/components/ui/screen", () => {
	const { View, ScrollView } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return { Screen: View, ScreenScroll: ScrollView };
});
jest.mock("~/components/ui/action-sheet", () => ({ ActionSheet: () => null }));
jest.mock("~/components/ui/confirmation-sheet", () => ({
	ConfirmationSheet: ({ visible }: { visible: boolean }) => {
		mockPauseVisible = visible;
		return null;
	},
}));
jest.mock("~/components/ui/date-time-picker-sheet", () => ({
	DateTimePickerSheet: () => null,
}));
jest.mock("~/components/ui/select-sheet", () => ({ SelectSheet: () => null }));
jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetFrame: () => null,
}));
jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);
	return new Proxy({}, { get: () => Icon });
});
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { primary: "#00A0E6", secondaryText: "#697586", text: "#111111" },
	}),
}));

beforeEach(() => {
	jest.clearAllMocks();
	mockCreateEntry.mockResolvedValue("exam-1");
	mockUpdateEntry.mockResolvedValue(undefined);
	mockSnapshot = undefined;
	mockPauseVisible = false;
	mockParams = {
		type: "exam",
		step: "learningAvailability",
		subject: "Biologie",
		examTypeLabel: "Klassenarbeit",
		dayKey: "2026-09-30",
	};
});

function followReplacement() {
	const destination = mockRouter.replace.mock.calls.at(-1)?.[0];
	expect(typeof destination).toBe("string");
	const url = new URL(destination as string, "https://dayova.test");
	mockParams = Object.fromEntries(url.searchParams);
	mockRouter.replace.mockClear();
	return url.pathname;
}

describe("exam creation across the topics boundary", () => {
	test("returns from 60% to 50% and can continue again with the same exam", async () => {
		let screen = await render(<NewEntryScreen />);
		expect(mockProgress.currentStep).toBe(2.5);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(followReplacement()).toBe("/learning-plans/new");
		await screen.unmount();
		screen = await render(<NewLearningPlanScreen />);
		expect(mockProgress.currentStep).toBe(3);
		await fireEvent.changeText(
			screen.getByLabelText("Prüfungsthemen"),
			"Zellteilung und Mitose",
		);
		await act(() => mockProgress.onBack());
		expect(mockRouter.dismissTo).not.toHaveBeenCalled();
		expect(followReplacement()).toBe("/entry/new");
		await screen.unmount();
		screen = await render(<NewEntryScreen />);
		expect(mockProgress.currentStep).toBe(2.5);
		expect(
			screen.getByText("Ist genug Lernzeit eingeplant?"),
		).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(followReplacement()).toBe("/learning-plans/new");
		expect(mockParams).toMatchObject({
			subject: "Biologie",
			examDateKey: "2026-09-30",
			topicDescription: "Zellteilung und Mitose",
			examDayEntryId: "exam-1",
		});
		expect(mockCreateEntry).toHaveBeenCalledTimes(1);
		expect(mockUpdateEntry).toHaveBeenCalledTimes(1);
		await screen.unmount();
	});

	test("edits earlier answers on the same exam and keeps a failed save recoverable", async () => {
		mockParams.examDayEntryId = "exam-1";
		mockParams.durationMinutes = "90";
		const screen = await render(<NewEntryScreen />);
		await act(() => mockProgress.onBack());
		expect(mockProgress.currentStep).toBe(2);
		await act(() => mockProgress.onBack());
		await fireEvent.press(screen.getByRole("radio", { name: "Chemie" }));
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		mockUpdateEntry.mockRejectedValueOnce(
			new Error("Speichern fehlgeschlagen"),
		);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(screen.getByText("Speichern fehlgeschlagen")).toBeOnTheScreen();
		expect(mockRouter.replace).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(mockUpdateEntry).toHaveBeenLastCalledWith(
			expect.objectContaining({
				id: "exam-1",
				subject: "Chemie",
				dayKey: "2026-09-30",
				durationMinutes: 90,
			}),
		);
		expect(mockCreateEntry).not.toHaveBeenCalled();
		expect(followReplacement()).toBe("/learning-plans/new");
	});

	test("returns to the existing exam when setup was opened from its detail page", async () => {
		mockParams = {
			examDayEntryId: "exam-1",
			subject: "Biologie",
			examDateKey: "2026-09-30",
		};
		await render(<NewLearningPlanScreen />);
		await act(() => mockProgress.onBack());
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/entry/exam-1");
		expect(mockRouter.replace).not.toHaveBeenCalled();
	});

	test("still confirms pausing a saved learning-plan draft", async () => {
		mockParams = {
			learningPlanId: "plan-1",
			examDayEntryId: "exam-1",
			fromExamEntry: "true",
			step: "topic",
		};
		mockSnapshot = {
			plan: { topicDescription: "Zellteilung und Mitose" },
			documents: [],
		};
		await render(<NewLearningPlanScreen />);
		await act(() => mockProgress.onBack());
		expect(mockPauseVisible).toBe(true);
		expect(mockRouter.replace).not.toHaveBeenCalled();
		expect(mockRouter.dismissTo).not.toHaveBeenCalled();
	});
});
