import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
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
				fileName: "mitschrift-2.png",
				fileType: "image/png",
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
