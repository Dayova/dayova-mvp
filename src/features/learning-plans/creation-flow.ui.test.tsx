jest.mock("~/lib/prepare-learning-photo", () => ({
	prepareLearningPhoto: async (uri: string, name: string) => ({
		uri,
		name: name.replace(/\.[^.]+$/, ".jpg"),
		mimeType: "image/jpeg",
		size: 1024,
	}),
}));

import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
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

jest.mock("~/context/AiConsentContext", () => ({
	useAiConsent: () => ({ requestAiConsent: async () => true }),
}));

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
const mockGenerateUploadUrl = jest.fn<() => Promise<Record<string, unknown>>>();
const mockRegisterUploadedDocument = jest.fn<() => Promise<void>>();
const mockCapture = jest.fn();
const mockFetch =
	jest.fn<
		(_input: unknown, _init?: unknown) => Promise<Record<string, unknown>>
	>();
const mockRequestMediaLibraryPermissions =
	jest.fn<() => Promise<{ granted: boolean }>>();
const mockLaunchImageLibrary =
	jest.fn<
		(_options: unknown) => Promise<{
			canceled: boolean;
			assets: Array<{
				fileName: string;
				fileSize: number;
				mimeType: string;
				uri: string;
			}> | null;
		}>
	>();
const mockAvailability = { status: "available" };
let mockSnapshot:
	| { plan: { topicDescription: string }; documents: never[] }
	| undefined;
let mockPauseVisible = false;
let mockRemovalAllowed = false;
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
		const functionName = getFunctionName(
			reference as Parameters<typeof getFunctionName>[0],
		);
		if (functionName === "dayEntries:create") return mockCreateEntry;
		if (functionName === "learningPlans:createDraft")
			return async () => "plan-1";
		if (functionName === "learningPlans:generateUploadUrl") {
			return mockGenerateUploadUrl;
		}
		return mockUpdateEntry;
	},
	useAction: (reference: unknown) => {
		const { getFunctionName } =
			jest.requireActual<typeof import("convex/server")>("convex/server");
		return getFunctionName(
			reference as Parameters<typeof getFunctionName>[0],
		) === "learningPlans:registerUploadedDocument"
			? mockRegisterUploadedDocument
			: jest.fn();
	},
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
		const { useContext, useSyncExternalStore } =
			jest.requireActual<typeof import("react")>("react");
		const navigation = useContext(NavigationContext);
		const focused = useSyncExternalStore(
			(notify) => {
				const offFocus = navigation?.addListener("focus", notify);
				const offBlur = navigation?.addListener("blur", notify);
				return () => {
					offFocus?.();
					offBlur?.();
				};
			},
			() => navigation?.isFocused() ?? true,
		);
		if (focused) mockProgress = configuration;
	},
}));
jest.mock("~/lib/navigation", () => ({
	...jest.requireActual<typeof import("~/lib/navigation-actions")>(
		"~/lib/navigation-actions",
	),
	useBackIntent: (
		_enabled: boolean,
		onBack: () => boolean,
		options?: { allowRouteRemoval?: boolean },
	) => {
		mockRemovalAllowed = options?.allowRouteRemoval ?? false;
		return onBack;
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
jest.mock("expo/fetch", () => ({
	fetch: (input: unknown, init?: unknown) => mockFetch(input, init),
}));
jest.mock("expo-file-system", () => ({
	File: class MockFile {
		uri: string;

		constructor(uri: string) {
			this.uri = uri;
		}

		info() {
			return { size: 0 };
		}
	},
}));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-image-picker", () => ({
	requestMediaLibraryPermissionsAsync: () =>
		mockRequestMediaLibraryPermissions(),
	launchImageLibraryAsync: (options: unknown) =>
		mockLaunchImageLibrary(options),
	UIImagePickerPreferredAssetRepresentationMode: {
		Automatic: "automatic",
	},
}));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("react-native-keyboard-controller", () => ({
	KeyboardStickyView:
		jest.requireActual<typeof import("react-native")>("react-native").View,
}));
jest.mock("react-native-reanimated", () =>
	require("../../../tests/mocks/selection-reanimated.cjs"),
);
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
jest.mock("~/components/ui/action-sheet", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { Pressable, Text, View } =
		jest.requireActual<typeof import("react-native")>("react-native");

	return {
		actionSheetIconColor: "#00A0E6",
		ActionSheet: ({
			visible,
			options,
			onDismiss,
			onSelect,
		}: {
			visible: boolean;
			options: Array<{
				value: string;
				title: string;
				description?: string;
				disabled?: boolean;
			}>;
			onDismiss?: () => void;
			onSelect: (value: string) => void;
		}) => {
			if (!visible) return null;
			return React.createElement(
				View,
				null,
				...options.map((option) =>
					React.createElement(
						Pressable,
						{
							accessibilityLabel: option.description
								? `${option.title}. ${option.description}`
								: option.title,
							accessibilityRole: "button",
							disabled: option.disabled,
							key: option.value,
							onPress: () => {
								onSelect(option.value);
								onDismiss?.();
							},
						},
						React.createElement(Text, null, option.title),
					),
				),
			);
		},
	};
});
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
const Planning = () => <EntryStepScreen step="planning" />;
function NewEntryScreen() {
	return (
		<NavigationContainer>
			<EntryDraftProvider>
				<EntryStack.Navigator>
					<EntryStack.Screen name="index" component={EntryStartScreen} />
					<EntryStack.Screen name="subject" component={Subject} />
					<EntryStack.Screen name="date" component={DateStep} />
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
	mockGenerateUploadUrl.mockResolvedValue({
		uploadUrl: "https://upload.dayova.test/material",
		uploadToken: "upload-token",
		storageId: "storage-id",
		storageProvider: "r2",
	});
	mockRegisterUploadedDocument.mockResolvedValue(undefined);
	mockFetch.mockResolvedValue({
		headers: { forEach: jest.fn() },
		ok: true,
		status: 200,
		statusText: "OK",
		text: async () => "",
	});
	mockRequestMediaLibraryPermissions.mockResolvedValue({ granted: true });
	mockLaunchImageLibrary.mockResolvedValue({ canceled: true, assets: null });
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
	test("returns from topics to the exam date and can continue again with the same exam", async () => {
		let screen = await render(<NewEntryScreen />);
		expect(mockProgress.currentStep).toBe(2);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(followReplacement()).toBe("/learning-plans/new");
		await screen.unmount();
		screen = await render(<NewLearningPlanScreen />);
		expect(mockProgress.currentStep).toBe(2.5);
		await fireEvent.changeText(
			screen.getByLabelText("Prüfungsthemen"),
			"Zellteilung und Mitose",
		);
		await act(() => mockProgress.onBack());
		expect(mockRouter.dismissTo).not.toHaveBeenCalled();
		expect(followReplacement()).toBe("/entry/new");
		await screen.unmount();
		screen = await render(<NewEntryScreen />);
		expect(mockProgress.currentStep).toBe(2);
		expect(
			screen.getByText("Wann findet die Prüfung statt?"),
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
		expect(mockProgress.currentStep).toBe(1.5);
		await fireEvent.press(screen.getByRole("radio", { name: "Chemie" }));
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

	test("releases removal protection before completing a new exam with material later", async () => {
		mockParams = {
			examDayEntryId: "exam-1",
			step: "topic",
			topicDescription: "Zellteilung und Mitose",
		};
		mockSnapshot = {
			plan: { topicDescription: "Zellteilung und Mitose" },
			documents: [],
		};
		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(mockRemovalAllowed).toBe(false);
		let removalAllowedAtDispatch = false;
		mockRouter.replace.mockImplementationOnce(() => {
			removalAllowedAtDispatch = mockRemovalAllowed;
		});
		await fireEvent.press(
			screen.getByRole("button", { name: "Später hinzufügen" }),
		);
		expect(mockRouter.replace).toHaveBeenCalledWith(
			expect.stringContaining("/entry/success?"),
		);
		expect(removalAllowedAtDispatch).toBe(true);
	});

	test("lets a resumed materialless draft be postponed again", async () => {
		mockParams = {
			learningPlanId: "plan-1",
			examDayEntryId: "exam-1",
			step: "material",
		};
		mockSnapshot = {
			plan: { topicDescription: "Zellteilung und Mitose" },
			documents: [],
		};
		const screen = await render(<NewLearningPlanScreen />);
		expect(mockRemovalAllowed).toBe(false);
		let removalAllowedAtDispatch = false;
		mockRouter.dismissTo.mockImplementationOnce(() => {
			removalAllowedAtDispatch = mockRemovalAllowed;
		});
		await fireEvent.press(
			screen.getByRole("button", { name: "Später hinzufügen" }),
		);
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans");
		expect(removalAllowedAtDispatch).toBe(true);
		expect(mockRouter.replace).not.toHaveBeenCalled();
	});

	test("uploads existing gallery photos through the learning-material pipeline", async () => {
		mockParams = {
			learningPlanId: "plan-1",
			examDayEntryId: "exam-1",
			step: "material",
		};
		mockSnapshot = {
			plan: { topicDescription: "Zellteilung und Mitose" },
			documents: [],
		};
		mockLaunchImageLibrary.mockResolvedValue({
			canceled: false,
			assets: [
				{
					fileName: "mitschrift-1.jpg",
					fileSize: 1_024,
					mimeType: "image/jpeg",
					uri: "file:///mitschrift-1.jpg",
				},
				{
					fileName: "mitschrift-2.png",
					fileSize: 2_048,
					mimeType: "image/png",
					uri: "file:///mitschrift-2.png",
				},
			],
		});

		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.press(
			screen.getByRole("button", { name: "Schulmaterial hinzufügen" }),
		);
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Mediathek. Vorhandene Fotos auswählen",
			}),
		);

		await waitFor(() => {
			expect(mockRegisterUploadedDocument).toHaveBeenCalledTimes(2);
		});
		expect(mockLaunchImageLibrary).toHaveBeenCalledWith(
			expect.objectContaining({
				allowsMultipleSelection: true,
				mediaTypes: ["images"],
				preferredAssetRepresentationMode: "automatic",
				shouldDownloadFromNetwork: true,
			}),
		);
		expect(mockRegisterUploadedDocument).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				fileName: "mitschrift-1.jpg",
				fileType: "image/jpeg",
				learningPlanId: "plan-1",
				sourceKind: "school",
			}),
		);
		expect(mockRegisterUploadedDocument).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				fileName: "mitschrift-2.jpg",
				fileType: "image/jpeg",
				learningPlanId: "plan-1",
				sourceKind: "school",
			}),
		);
	});

	test("keeps a denied gallery permission recoverable in the upload step", async () => {
		mockParams = {
			learningPlanId: "plan-1",
			examDayEntryId: "exam-1",
			step: "material",
		};
		mockSnapshot = {
			plan: { topicDescription: "Zellteilung und Mitose" },
			documents: [],
		};
		mockRequestMediaLibraryPermissions.mockResolvedValue({ granted: false });

		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.press(
			screen.getByRole("button", { name: "Schulmaterial hinzufügen" }),
		);
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Mediathek. Vorhandene Fotos auswählen",
			}),
		);

		await waitFor(() => {
			expect(
				screen.getByText(
					"Erlaube den Zugriff auf deine Fotos, um Bilder aus deiner Mediathek hochzuladen.",
				),
			).toBeOnTheScreen();
		});
		expect(mockLaunchImageLibrary).not.toHaveBeenCalled();
	});
});

describe("entry native history and shared answers", () => {
	test("preserves a personal subject identity across Back and the topics handoff", async () => {
		mockParams.step = "basics";
		mockParams.personalSubjectId = "personal-subject-1";
		mockParams.examDayEntryId = "exam-1";
		const screen = await render(<NewEntryScreen />);
		await act(() => mockProgress.onBack());
		expect(screen.getByTestId("entry-history").props.children).toBe(
			"index,subject",
		);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(mockUpdateEntry).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "exam-1",
			}),
		);
		expect(followReplacement()).toBe("/learning-plans/new");
		expect(mockParams.personalSubjectId).toBe("personal-subject-1");
		expect(mockCreateEntry).not.toHaveBeenCalled();
	});

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
				.checked,
		).toBe(true);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(
			screen.getByRole("radio", { name: "Chemie" }).props.accessibilityState
				.checked,
		).toBe(true);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(screen.getByTestId("entry-history").props.children).toBe(
			"index,subject,date",
		);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(followReplacement()).toBe("/learning-plans/new");
		expect(mockCreateEntry).toHaveBeenCalledTimes(1);
	});

	test("resumes with the full predecessor history and the saved exam identity", async () => {
		mockParams.examDayEntryId = "exam-1";
		const screen = await render(<NewEntryScreen />);
		expect(screen.getByTestId("entry-history").props.children).toBe(
			"index,subject,date",
		);
		await act(() => mockProgress.onBack());
		await act(() => mockProgress.onBack());
		expect(screen.getByTestId("entry-history").props.children).toBe("index");
		expect(
			screen.getByRole("radio", { name: "Klassenarbeit" }).props
				.accessibilityState.checked,
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

	test("a new flow cannot inherit answers from a discarded flow", async () => {
		mockParams = { type: "exam" };
		let screen = await render(<NewEntryScreen />);
		await fireEvent.press(screen.getByRole("radio", { name: "Klausur" }));
		await screen.unmount();
		screen = await render(<NewEntryScreen />);
		expect(
			screen.getByRole("radio", { name: "Klausur" }).props.accessibilityState
				.checked,
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
		mockCreateEntry.mockImplementationOnce(
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
			"index,subject,date",
		);
		expect(mockCreateEntry).toHaveBeenCalledTimes(1);
		await act(() => rejectSave(new Error("Offline")));
		expect(screen.getByText("Offline")).toBeOnTheScreen();
		await act(() => mockProgress.onBack());
		expect(screen.getByTestId("entry-history").props.children).toBe(
			"index,subject",
		);
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
		"index,subject,date",
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
