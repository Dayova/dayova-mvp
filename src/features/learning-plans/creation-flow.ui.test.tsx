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
	| { plan: { topicDescription: string; status?: string }; documents: never[] }
	| null
	| undefined;
let mockPauseVisible = false;
type RemovalCallback = (event: { data: { action: { type: string } } }) => void;
const mockRemovalGuards = new Map<
	string,
	{ enabled: boolean; callback: RemovalCallback }
>();
const mockNativeDispatch = jest.fn();
const mockPreventRemove = () => {
	let prevented = false;
	for (const guard of mockRemovalGuards.values()) {
		if (!guard.enabled) continue;
		prevented = true;
		guard.callback({ data: { action: { type: "POP" } } });
	}
	return prevented;
};
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
jest.mock("expo-router/react-navigation", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		useIsFocused: () => true,
		useNavigation: () => ({ dispatch: mockNativeDispatch }),
		useFocusEffect: (effect: () => undefined | (() => void)) =>
			React.useEffect(effect, [effect]),
		usePreventRemove: (enabled: boolean, callback: RemovalCallback) => {
			const id = React.useId();
			React.useEffect(() => {
				mockRemovalGuards.set(id, { enabled, callback });
				return () => {
					mockRemovalGuards.delete(id);
				};
			}, [id, enabled, callback]);
		},
	};
});
jest.mock("~/features/learning-plans/creation-progress-shell", () => ({
	useLearningPlanCreationProgress: (configuration: typeof mockProgress) => {
		mockProgress = configuration;
	},
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
jest.mock("~/components/ui/date-time-picker-sheet", () => ({
	DateTimePickerSheet: () => null,
}));
jest.mock("~/components/ui/select-sheet", () => ({ SelectSheet: () => null }));
jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetFrame: ({
		visible,
		title,
		children,
		footer,
	}: {
		visible: boolean;
		title: string;
		children: import("react").ReactNode;
		footer: import("react").ReactNode;
	}) => {
		mockPauseVisible = visible;
		const { View, Text } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return visible ? (
			<View>
				<Text>{title}</Text>
				{children}
				{footer}
			</View>
		) : null;
	},
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
	mockRemovalGuards.clear();
	mockCreateEntry.mockResolvedValue("exam-1");
	mockUpdateEntry.mockReset().mockResolvedValue(undefined);
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

	test("preserves a one-time subject across the learning-plan boundary", async () => {
		mockParams.subject = "Debattieren";
		mockParams.subjectIsOneTime = "true";
		let screen = await render(<NewEntryScreen />);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(followReplacement()).toBe("/learning-plans/new");
		expect(mockParams.subjectIsOneTime).toBe("true");
		await screen.unmount();

		screen = await render(<NewLearningPlanScreen />);
		await act(() => mockProgress.onBack());
		expect(followReplacement()).toBe("/entry/new");
		expect(mockParams).toMatchObject({
			subject: "Debattieren",
			subjectIsOneTime: "true",
		});
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
		expect(mockUpdateEntry).toHaveBeenCalledTimes(1);
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
		await act(() => {
			expect(mockPreventRemove()).toBe(false);
		});
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

describe("editing from a learning-plan card", () => {
	beforeEach(() => {
		mockParams = { learningPlanId: "plan-1", mode: "edit" };
		mockSnapshot = {
			plan: { topicDescription: "Zellteilung und Mitose", status: "draft" },
			documents: [],
		};
	});
	test("can cancel directly without school material", async () => {
		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.press(screen.getByRole("button", { name: "Abbrechen" }));
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans");
		expect(mockUpdateEntry).not.toHaveBeenCalled();
	});
	test("protects topic changes on native back, keeps editing, then discards", async () => {
		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.changeText(
			screen.getByLabelText("Prüfungsthemen"),
			"Genetik und Vererbung",
		);
		await act(() => mockPreventRemove?.());
		expect(screen.getByText("Änderungen verwerfen?")).toBeOnTheScreen();
		expect(mockRouter.dismissTo).not.toHaveBeenCalled();
		await fireEvent.press(
			screen.getByRole("button", { name: "Weiter bearbeiten" }),
		);
		expect(screen.getByLabelText("Prüfungsthemen")).toHaveDisplayValue(
			"Genetik und Vererbung",
		);
		await fireEvent.press(screen.getByRole("button", { name: "Abbrechen" }));
		await fireEvent.press(screen.getByRole("button", { name: "Verwerfen" }));
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans");
		expect(mockUpdateEntry).not.toHaveBeenCalled();
	});
	test("saves topics without requiring material and returns to plans", async () => {
		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.changeText(
			screen.getByLabelText("Prüfungsthemen"),
			"Genetik und Vererbung",
		);
		await fireEvent.press(screen.getByRole("button", { name: "Speichern" }));
		expect(mockUpdateEntry).toHaveBeenCalledWith({
			id: "plan-1",
			topicDescription: "Genetik und Vererbung",
		});
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans");
		expect(mockRouter.push).not.toHaveBeenCalled();
	});
	test("retries saving topics once when authentication resumes", async () => {
		mockUpdateEntry.mockRejectedValueOnce(new Error("Nicht authentifiziert."));
		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.changeText(
			screen.getByLabelText("Prüfungsthemen"),
			"Genetik und Vererbung",
		);
		await fireEvent.press(screen.getByRole("button", { name: "Speichern" }));
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 750));
		});
		expect(mockUpdateEntry).toHaveBeenCalledTimes(2);
		expect(mockUpdateEntry).toHaveBeenLastCalledWith({
			id: "plan-1",
			topicDescription: "Genetik und Vererbung",
		});
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans");
	});
	test("keeps the draft editable when the authentication retry also fails", async () => {
		mockUpdateEntry
			.mockRejectedValueOnce(new Error("Nicht authentifiziert."))
			.mockRejectedValueOnce(new Error("Nicht authentifiziert."));
		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.changeText(
			screen.getByLabelText("Prüfungsthemen"),
			"Genetik und Vererbung",
		);
		await fireEvent.press(screen.getByRole("button", { name: "Speichern" }));
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 750));
		});
		expect(mockUpdateEntry).toHaveBeenCalledTimes(2);
		expect(mockRouter.dismissTo).not.toHaveBeenCalled();
		expect(screen.getByText("Nicht authentifiziert.")).toBeOnTheScreen();
		expect(screen.getByLabelText("Prüfungsthemen")).toHaveDisplayValue(
			"Genetik und Vererbung",
		);
		await fireEvent.press(screen.getByRole("button", { name: "Speichern" }));
		expect(mockUpdateEntry).toHaveBeenCalledTimes(3);
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans");
	});
	test("retains the draft after a save error and allows retry", async () => {
		mockUpdateEntry.mockRejectedValueOnce(
			new Error("Speichern fehlgeschlagen"),
		);
		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.changeText(
			screen.getByLabelText("Prüfungsthemen"),
			"Genetik und Vererbung",
		);
		await fireEvent.press(screen.getByRole("button", { name: "Speichern" }));
		expect(screen.getByText("Speichern fehlgeschlagen")).toBeOnTheScreen();
		expect(mockUpdateEntry).toHaveBeenCalledTimes(1);
		expect(screen.getByLabelText("Prüfungsthemen")).toHaveDisplayValue(
			"Genetik und Vererbung",
		);
		expect(mockRouter.dismissTo).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("button", { name: "Speichern" }));
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans");
	});
	test("can leave an accepted plan without calling the draft-only topic mutation", async () => {
		mockSnapshot = {
			plan: { topicDescription: "Zellteilung und Mitose", status: "accepted" },
			documents: [],
		};
		const screen = await render(<NewLearningPlanScreen />);
		expect(screen.queryByLabelText("Prüfungsthemen")).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: "Speichern" }));
		expect(mockUpdateEntry).not.toHaveBeenCalled();
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans");
	});
});

describe("learning-plan editor recovery", () => {
	beforeEach(() => {
		mockParams = { learningPlanId: "plan-1", mode: "edit" };
		mockSnapshot = {
			plan: { topicDescription: "Zellteilung und Mitose", status: "draft" },
			documents: [],
		};
	});
	test.each([
		undefined,
		null,
	])("keeps cancel available while the snapshot is %s", async (snapshot) => {
		mockSnapshot = snapshot;
		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.press(screen.getByRole("button", { name: "Abbrechen" }));
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans");
	});
	test("allows discarding invalid topics even though saving is disabled", async () => {
		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.changeText(screen.getByLabelText("Prüfungsthemen"), "");
		expect(screen.getByRole("button", { name: "Speichern" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("button", { name: "Abbrechen" }));
		await fireEvent.press(screen.getByRole("button", { name: "Verwerfen" }));
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans");
	});
	test("does not prompt after restoring the original topics", async () => {
		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.changeText(
			screen.getByLabelText("Prüfungsthemen"),
			"Genetik",
		);
		await fireEvent.changeText(
			screen.getByLabelText("Prüfungsthemen"),
			"Zellteilung und Mitose",
		);
		await act(() => mockPreventRemove?.());
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans");
		expect(screen.queryByText("Änderungen verwerfen?")).toBeNull();
	});
	test("locks repeated saves but lets the user leave a pending write honestly", async () => {
		let finish: () => void = () => {};
		mockUpdateEntry.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		);
		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.changeText(
			screen.getByLabelText("Prüfungsthemen"),
			"Genetik und Vererbung",
		);
		const save = screen.getByRole("button", { name: "Speichern" });
		await fireEvent.press(save);
		await fireEvent.press(save);
		expect(mockUpdateEntry).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("button", { name: "Abbrechen" })).toBeEnabled();
		await act(() => mockPreventRemove?.());
		expect(screen.queryByText("Änderungen verwerfen?")).toBeNull();
		expect(screen.getByText("Speichern läuft noch")).toBeOnTheScreen();
		expect(mockRouter.dismissTo).not.toHaveBeenCalled();
		await fireEvent.press(
			screen.getByRole("button", { name: "Zurück zu Pläne" }),
		);
		expect(mockRouter.dismissTo).toHaveBeenCalledTimes(1);
		await act(async () => finish());
		expect(mockRouter.dismissTo).toHaveBeenCalledTimes(1);
	});
});

describe("confirming pause after navigating back from material", () => {
	test("lets the confirmed POP reach Pläne instead of reopening the pause dialog", async () => {
		mockParams = { learningPlanId: "plan-1", step: "material" };
		mockSnapshot = {
			plan: { topicDescription: "Lineare Gleichung", status: "draft" },
			documents: [],
		};
		const screen = await render(<NewLearningPlanScreen />);
		await act(() => mockProgress.onBack());
		expect(screen.getByLabelText("Prüfungsthemen")).toHaveDisplayValue(
			"Lineare Gleichung",
		);
		await act(() => mockProgress.onBack());
		expect(
			screen.getByText("Lernplan-Erstellung pausieren?"),
		).toBeOnTheScreen();
		await fireEvent.press(
			screen.getByRole("button", { name: "Später fortsetzen" }),
		);
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans");
		// Expo Router queues dismissTo; the native stack removes the route after render.
		let prevented = false;
		await act(() => {
			prevented = mockPreventRemove();
		});
		expect(prevented).toBe(false);
		expect(screen.queryByText("Lernplan-Erstellung pausieren?")).toBeNull();
	});
});

describe("continuing a paused creation", () => {
	test("can pause directly from the material step without uploading a file", async () => {
		mockParams = { learningPlanId: "plan-1", step: "material" };
		mockSnapshot = {
			plan: { topicDescription: "Lineare Gleichung", status: "draft" },
			documents: [],
		};
		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.press(
			screen.getByRole("button", { name: "Später fortsetzen" }),
		);
		expect(
			screen.getByText("Lernplan-Erstellung pausieren?"),
		).toBeOnTheScreen();
		await fireEvent.press(
			screen.getByRole("button", { name: "Weiter bearbeiten" }),
		);
		expect(screen.getByText("Schulmaterial hinzufügen")).toBeOnTheScreen();
		expect(mockRouter.dismissTo).not.toHaveBeenCalled();
		await fireEvent.press(
			screen.getByRole("button", { name: "Später fortsetzen" }),
		);
		await fireEvent.press(
			screen.getAllByRole("button", { name: "Später fortsetzen" })[1],
		);
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans");
		await act(() => {
			expect(mockPreventRemove()).toBe(false);
		});
		expect(mockUpdateEntry).not.toHaveBeenCalled();
	});

	test("keeps the topics when continuing, then allows a later confirmed exit", async () => {
		mockParams = { learningPlanId: "plan-1", step: "topic" };
		mockSnapshot = {
			plan: { topicDescription: "Lineare Gleichung", status: "draft" },
			documents: [],
		};
		const screen = await render(<NewLearningPlanScreen />);
		await act(() => {
			expect(mockPreventRemove()).toBe(true);
		});
		await fireEvent.press(
			screen.getByRole("button", { name: "Weiter bearbeiten" }),
		);
		expect(screen.queryByText("Lernplan-Erstellung pausieren?")).toBeNull();
		expect(mockRouter.dismissTo).not.toHaveBeenCalled();
		await fireEvent.changeText(
			screen.getByLabelText("Prüfungsthemen"),
			"Lineare Gleichungen und Funktionen",
		);
		await act(() => mockProgress.onBack());
		await fireEvent.press(
			screen.getByRole("button", { name: "Später fortsetzen" }),
		);
		await act(() => {
			expect(mockPreventRemove()).toBe(false);
		});
		expect(mockRouter.dismissTo).toHaveBeenCalledTimes(1);
	});
});
