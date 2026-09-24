import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import {
	createNavigatorFactory,
	NavigationContainer,
	type NavigatorScreenParams,
	StackRouter,
	useNavigationBuilder,
} from "expo-router/react-navigation";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import NewLearningPlanScreen from "~/app/(creation)/learning-plans/new";
import { EntryDraftProvider } from "~/features/entries/entry-draft";
import { EntryStartScreen } from "~/features/entries/entry-start-screen";
import { EntryStepScreen } from "~/features/entries/entry-step-screen";

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
	useRouter: () => {
		// Learning-plan assertions use their existing router fixture outside a navigator.
		const { NavigationContext } = jest.requireActual<
			typeof import("expo-router/react-navigation")
		>("expo-router/react-navigation");
		const { useContext } = jest.requireActual<typeof import("react")>("react");
		const navigation = useContext(NavigationContext);
		return navigation
			? {
					...mockRouter,
					navigate: (path: string) =>
						navigation.navigate(path.split("/").at(-1) as never),
					back: () => navigation.goBack(),
					canGoBack: () => navigation.canGoBack(),
				}
			: mockRouter;
	},
	useLocalSearchParams: () => mockParams,
	Stack: { Screen: () => null },
	Redirect: () => null,
}));
jest.mock("~/features/learning-plans/creation-progress-shell", () => ({
	useLearningPlanCreationProgress: (configuration: typeof mockProgress) => {
		const { NavigationContext } = jest.requireActual<
			typeof import("expo-router/react-navigation")
		>("expo-router/react-navigation");
		const { useContext } = jest.requireActual<typeof import("react")>("react");
		const navigation = useContext(NavigationContext);
		// Subscribe to focus even while the previous screen remains mounted.
		const focused = navigation?.isFocused() ?? true;
		if (focused) mockProgress = configuration;
	},
}));
jest.mock("~/lib/navigation", () => ({
	...jest.requireActual<typeof import("~/lib/navigation-actions")>(
		"~/lib/navigation-actions",
	),
	useBackIntent: (_enabled: boolean, onBack: () => boolean) => onBack,
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

function EntryTestNavigator({ children }: { children: ReactNode }) {
	const { state, descriptors, NavigationContent } = useNavigationBuilder(
		StackRouter,
		{ children },
	);
	return (
		<NavigationContent>
			<Text testID="entry-history">
				{state.routes.map((route) => route.name).join(",")}
			</Text>
			{state.routes.map((route, index) => (
				<View
					key={route.key}
					style={{ display: index === state.index ? "flex" : "none" }}
				>
					{descriptors[route.key].render()}
				</View>
			))}
		</NavigationContent>
	);
}
const EntryStack = createNavigatorFactory(EntryTestNavigator)();
const Subject = () => <EntryStepScreen step="examDetails" />;
const DateStep = () => <EntryStepScreen step="basics" />;
const Availability = () => <EntryStepScreen step="learningAvailability" />;
const Planning = () => <EntryStepScreen step="planning" />;
function NewEntryScreen() {
	return (
		<NavigationContainer>
			<EntryDraftProvider>
				<EntryStack.Navigator>
					<EntryStack.Screen name="index" component={EntryStartScreen} />
					<EntryStack.Screen name="subject" component={Subject} />
					<EntryStack.Screen name="date" component={DateStep} />
					<EntryStack.Screen name="availability" component={Availability} />
					<EntryStack.Screen name="planning" component={Planning} />
				</EntryStack.Navigator>
			</EntryDraftProvider>
		</NavigationContainer>
	);
}

beforeEach(() => {
	jest.clearAllMocks();
	mockCreateEntry.mockResolvedValue("exam-1");
	mockUpdateEntry.mockResolvedValue(undefined);
	mockSnapshot = undefined;
	mockPauseVisible = false;
	mockParams = {
		type: "exam",
		step: "learningAvailability",
		examDayEntryId: "exam-1",
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
		expect(mockCreateEntry).not.toHaveBeenCalled();
		expect(mockUpdateEntry).toHaveBeenCalledTimes(2);
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

describe("entry native history and shared answers", () => {
	test("creates one history entry per step and retains answers after native Back", async () => {
		mockParams = { type: "exam" };
		const screen = await render(<NewEntryScreen />);
		expect(screen.getByRole("button", { name: "Weiter" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("radio", { name: "Klausur" }));
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(screen.getByTestId("entry-history").props.children).toBe(
			"index,subject",
		);
		expect(screen.getByRole("button", { name: "Weiter" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("radio", { name: "Chemie" }));
		await act(() => mockProgress.onBack());
		expect(screen.getByTestId("entry-history").props.children).toBe("index");
		expect(
			screen.getByRole("radio", { name: "Klausur" }).props.accessibilityState
				.selected,
		).toBe(true);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(
			screen.getByRole("radio", { name: "Chemie" }).props.accessibilityState
				.selected,
		).toBe(true);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(screen.getByTestId("entry-history").props.children).toBe(
			"index,subject,date",
		);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(screen.getByTestId("entry-history").props.children).toBe(
			"index,subject,date,availability",
		);
		await act(() => mockProgress.onBack());
		expect(
			screen.getByText("Wann findet die Prüfung statt?"),
		).toBeOnTheScreen();
		expect(screen.getByTestId("entry-history").props.children).toBe(
			"index,subject,date",
		);
	});

	test("resumes with the full predecessor history and the saved exam identity", async () => {
		mockParams.examDayEntryId = "exam-1";
		const screen = await render(<NewEntryScreen />);
		expect(screen.getByTestId("entry-history").props.children).toBe(
			"index,subject,date,availability",
		);
		await act(() => mockProgress.onBack());
		await act(() => mockProgress.onBack());
		await act(() => mockProgress.onBack());
		expect(screen.getByTestId("entry-history").props.children).toBe("index");
		expect(
			screen.getByRole("radio", { name: "Klassenarbeit" }).props
				.accessibilityState.selected,
		).toBe(true);
		expect(mockCreateEntry).not.toHaveBeenCalled();
	});

	test("starts incomplete resume links at the first step", async () => {
		delete mockParams.subject;
		const screen = await render(<NewEntryScreen />);
		expect(screen.getByTestId("entry-history").props.children).toBe("index");
		expect(
			screen.getByText("Welche Art von Prüfung ist es?"),
		).toBeOnTheScreen();
	});

	test.each([
		["missing exam ID", { dayKey: "2026-09-30" }],
		["missing date", { examDayEntryId: "exam-1" }],
		["invalid date", { examDayEntryId: "exam-1", dayKey: "2026-02-30" }],
	])("starts a clean flow for a resume with %s", async (_reason, fields) => {
		mockParams = {
			type: "exam",
			step: "learningAvailability",
			subject: "Biologie",
			examTypeLabel: "Klassenarbeit",
			...fields,
		};
		const screen = await render(<NewEntryScreen />);
		expect(screen.getByTestId("entry-history").props.children).toBe("index");
		expect(screen.getByRole("button", { name: "Weiter" })).toBeDisabled();
		expect(
			screen.getByRole("radio", { name: "Klassenarbeit" }).props
				.accessibilityState.selected,
		).toBe(false);
		expect(mockUpdateEntry).not.toHaveBeenCalled();
	});

	test("never updates an old exam from an incomplete resume link", async () => {
		mockParams = {
			type: "exam",
			step: "learningAvailability",
			examDayEntryId: "exam-1",
			subject: "Biologie",
			examTypeLabel: "Klassenarbeit",
		};
		const screen = await render(<NewEntryScreen />);
		await fireEvent.press(screen.getByRole("radio", { name: "Klausur" }));
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		await fireEvent.press(screen.getByRole("radio", { name: "Chemie" }));
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(mockCreateEntry).toHaveBeenCalledTimes(1);
		expect(mockUpdateEntry).not.toHaveBeenCalled();
	});

	test("a new flow cannot inherit answers from a discarded flow", async () => {
		mockParams = { type: "exam" };
		let screen = await render(<NewEntryScreen />);
		await fireEvent.press(screen.getByRole("radio", { name: "Klausur" }));
		await screen.unmount();
		screen = await render(<NewEntryScreen />);
		expect(
			screen.getByRole("radio", { name: "Klausur" }).props.accessibilityState
				.selected,
		).toBe(false);
		expect(screen.getByRole("button", { name: "Weiter" })).toBeDisabled();
	});

	test("keeps homework answers and native history across its planning step", async () => {
		mockParams = { type: "homework", subject: "Biologie" };
		const screen = await render(<NewEntryScreen />);
		await fireEvent.changeText(
			screen.getByPlaceholderText("Kurze Notiz hinzufügen"),
			"Arbeitsblatt 7",
		);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(screen.getByTestId("entry-history").props.children).toBe(
			"index,planning",
		);
		// Homework's visible Back delegates to the same navigator.
		await fireEvent.press(screen.getByRole("button", { name: "Zurück" }));
		expect(screen.getByTestId("entry-history").props.children).toBe("index");
		expect(screen.getByDisplayValue("Arbeitsblatt 7")).toBeOnTheScreen();
	});

	test("blocks repeated saves and Back while a save is pending, then recovers after failure", async () => {
		let rejectSave: (reason: Error) => void = () => {};
		mockUpdateEntry.mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					rejectSave = reject;
				}),
		);
		const screen = await render(<NewEntryScreen />);
		const submit = screen.getByRole("button", { name: "Weiter" });
		await fireEvent.press(submit);
		await fireEvent.press(submit);
		await act(() => mockProgress.onBack());
		expect(screen.getByTestId("entry-history").props.children).toBe(
			"index,subject,date,availability",
		);
		expect(mockUpdateEntry).toHaveBeenCalledTimes(1);
		await act(() => rejectSave(new Error("Offline")));
		expect(screen.getByText("Offline")).toBeOnTheScreen();
		await act(() => mockProgress.onBack());
		expect(
			screen.getByText("Wann findet die Prüfung statt?"),
		).toBeOnTheScreen();
	});
});

test("initializes a cold resume from leaf URL params when the parent layout has none", async () => {
	const { getStateFromPath } = jest.requireActual<
		typeof import("expo-router/build/fork/getStateFromPath")
	>("expo-router/build/fork/getStateFromPath");
	const state = getStateFromPath<{
		"(creation)": NavigatorScreenParams<{
			"entry/new": NavigatorScreenParams<{
				index: Record<string, string> | undefined;
				subject: undefined;
				date: undefined;
				availability: undefined;
			}>;
		}>;
	}>(
		"/entry/new?type=exam&step=learningAvailability&subject=Chemie&examTypeLabel=Klausur&examDayEntryId=exam-1&dayKey=2026-10-01&durationMinutes=90",
		{
			screens: {
				"(creation)": {
					path: "",
					screens: {
						"entry/new": {
							path: "entry/new",
							screens: {
								index: "",
								subject: "subject",
								date: "date",
								availability: "availability",
							},
						},
					},
				},
			},
		},
	);
	const layout = state?.routes[0].state?.routes[0];
	expect(layout?.params).toBeUndefined();
	const leaf = layout?.state?.routes[0];
	expect(leaf?.params).toMatchObject({
		type: "exam",
		examDayEntryId: "exam-1",
		subject: "Chemie",
		durationMinutes: "90",
	});
	mockParams = Object.fromEntries(
		Object.entries(leaf?.params ?? {}).map(([key, value]) => [
			key,
			String(value),
		]),
	);
	const screen = await render(<NewEntryScreen />);
	expect(screen.getByTestId("entry-history").props.children).toBe(
		"index,subject,date,availability",
	);
	await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
	expect(mockUpdateEntry).toHaveBeenCalledWith(
		expect.objectContaining({
			id: "exam-1",
			subject: "Chemie",
			examTypeLabel: "Klausur",
			dayKey: "2026-10-01",
			durationMinutes: 90,
		}),
	);
	expect(mockCreateEntry).not.toHaveBeenCalled();
});
