import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	test,
} from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import NewEntryScreen from "~/app/(creation)/entry/new";
import NewLearningPlanScreen from "~/app/(creation)/learning-plans/new";

let mockParams: Record<string, string> = {};
let mockProgress: {
	currentStep: number;
	onBack: () => void;
	onClose: () => void;
};
const mockRouter = {
	replace: jest.fn(),
	push: jest.fn(),
	dismissTo: jest.fn(),
	setParams: jest.fn(),
	back: jest.fn(),
	canGoBack: () => true,
};
const mockCreateEntry =
	jest.fn<(_args: Record<string, unknown>) => Promise<string>>();
const mockUpdateEntry =
	jest.fn<(_args: Record<string, unknown>) => Promise<void>>();
const mockUpdateRequiredTopics =
	jest.fn<(_args: Record<string, unknown>) => Promise<void>>();
const mockGenerateUploadUrl = jest.fn<() => Promise<Record<string, unknown>>>();
const mockRegisterUploadedDocument =
	jest.fn<(_args: Record<string, unknown>) => Promise<void>>();
const mockSearchTopics =
	jest.fn<
		() => Promise<{
			topics: { id: string; title: string }[];
			truncated: boolean;
		}>
	>();
const mockCapture = jest.fn();
const mockFetch =
	jest.fn<
		(_input: unknown, _init?: unknown) => Promise<Record<string, unknown>>
	>();
const mockRequestMediaLibraryPermissions =
	jest.fn<() => Promise<{ granted: boolean }>>();
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe1];
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP_HEADER = [
	0x52, 0x49, 0x46, 0x46, 0x20, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
];
let mockFiles: Record<
	string,
	{ size: number; header: number[]; readError?: string }
> = {};
const mockCloseFile = jest.fn();
const mockLaunchImageLibrary =
	jest.fn<
		(_options: unknown) => Promise<{
			canceled: boolean;
			assets: Array<{
				fileName: string | null;
				fileSize: number;
				mimeType: string | null | undefined;
				uri: string;
			}> | null;
		}>
	>();
const mockAvailability = { status: "available" };
let mockSnapshot:
	| {
			plan: {
				subject?: string;
				topicDescription: string;
				topicItems?: string[];
				topicAdditionalInfo?: string;
			};
			documents: never[];
	  }
	| undefined;
let mockPauseVisible = false;
let mockPauseProps: {
	onConfirm: () => void;
	isBusy?: boolean;
	errorMessage?: string | null;
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
		const functionName = getFunctionName(
			reference as Parameters<typeof getFunctionName>[0],
		);
		if (functionName === "dayEntries:create") return mockCreateEntry;
		if (functionName === "learningPlans:updateRequiredTopics") {
			return mockUpdateRequiredTopics;
		}
		if (functionName === "learningPlans:generateUploadUrl") {
			return mockGenerateUploadUrl;
		}
		return mockUpdateEntry;
	},
	useAction: (reference: unknown) => {
		const { getFunctionName } =
			jest.requireActual<typeof import("convex/server")>("convex/server");
		if (
			getFunctionName(reference as Parameters<typeof getFunctionName>[0]) ===
			"wloTopics:search"
		) {
			return mockSearchTopics;
		}
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
			return { size: mockFiles[this.uri]?.size ?? 1_024 };
		}

		open() {
			return {
				readBytesSync: (length: number) => {
					const file = mockFiles[this.uri];
					if (file?.readError) throw new Error(file.readError);
					return Uint8Array.from(
						(file?.header ?? JPEG_HEADER).slice(0, length),
					);
				},
				close: mockCloseFile,
			};
		}
	},
	FileMode: { ReadOnly: "r" },
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
	useKeyboardState: () => false,
	KeyboardStickyView:
		jest.requireActual<typeof import("react-native")>("react-native").View,
}));
jest.mock("react-native-reanimated", () =>
	jest.requireActual("../../../tests/mocks/selection-reanimated.cjs"),
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
	ConfirmationSheet: (props: typeof mockPauseProps & { visible: boolean }) => {
		mockPauseVisible = props.visible;
		mockPauseProps = props;
		return null;
	},
}));
jest.mock("~/components/ui/date-time-picker-sheet", () => ({
	DateTimePickerSheet: () => null,
}));
jest.mock("~/components/ui/inline-date-picker", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		InlineDatePicker: (props: Record<string, unknown>) =>
			React.createElement("InlineDatePicker", {
				...props,
				testID: "inline-calendar",
			}),
	};
});
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
	mockAvailability.status = "available";
	mockFiles = {
		"file:///mitschrift-2.png": { size: 2_048, header: PNG_HEADER },
	};
	mockCreateEntry.mockResolvedValue("exam-1");
	mockUpdateEntry.mockResolvedValue(undefined);
	mockUpdateRequiredTopics.mockResolvedValue(undefined);
	mockGenerateUploadUrl.mockResolvedValue({
		uploadUrl: "https://upload.dayova.test/material",
		uploadToken: "upload-token",
		storageId: "storage-id",
		storageProvider: "r2",
	});
	mockRegisterUploadedDocument.mockResolvedValue(undefined);
	mockSearchTopics.mockResolvedValue({
		topics: [{ id: "geraden", title: "Geraden" }],
		truncated: false,
	});
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
		step: "basics",
		subject: "Biologie",
		examTypeLabel: "Klassenarbeit",
		dayKey: "2026-09-30",
	};
});

afterEach(() => {
	jest.restoreAllMocks();
});

function followReplacement() {
	const destination = mockRouter.replace.mock.calls.at(-1)?.[0];
	expect(typeof destination).toBe("string");
	const url = new URL(destination as string, "https://dayova.test");
	mockParams = Object.fromEntries(url.searchParams);
	mockRouter.replace.mockClear();
	return url.pathname;
}

async function selectGalleryPhotos(
	assets: NonNullable<
		Awaited<ReturnType<typeof mockLaunchImageLibrary>>["assets"]
	>,
) {
	mockParams = {
		learningPlanId: "plan-1",
		examDayEntryId: "exam-1",
		step: "material",
	};
	mockSnapshot = {
		plan: { topicDescription: "Zellteilung und Mitose" },
		documents: [],
	};
	mockLaunchImageLibrary.mockResolvedValue({ canceled: false, assets });
	const screen = await render(<NewLearningPlanScreen />);
	await fireEvent.press(
		screen.getAllByRole("button", { name: "Schulmaterial hinzufügen" })[0],
	);
	await fireEvent.press(
		screen.getByRole("button", {
			name: "Galerie. Vorhandene Fotos auswählen",
		}),
	);
	return screen;
}

async function openHints(screen: Awaited<ReturnType<typeof render>>) {
	if (screen.queryByLabelText("Themen suchen"))
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
	expect(screen.getByLabelText("Hinweise suchen")).toBeOnTheScreen();
}
function expectHints(
	screen: Awaited<ReturnType<typeof render>>,
	value: string,
) {
	for (const line of value.split("\n").filter((line) => line.trim())) {
		expect(
			screen.getByRole("button", { name: `${line} entfernen` }),
		).toBeOnTheScreen();
	}
	if (!value)
		expect(
			screen.queryAllByRole("button", { name: / entfernen$/ }),
		).toHaveLength(0);
}
async function replaceHints(
	screen: Awaited<ReturnType<typeof render>>,
	value: string,
) {
	for (const chip of screen.getAllByRole("button", { name: / entfernen$/ })) {
		await fireEvent.press(chip);
	}
	if (value) await addHint(screen, value);
}
async function addHint(
	screen: Awaited<ReturnType<typeof render>>,
	hint: string,
) {
	await fireEvent.changeText(screen.getByLabelText("Hinweise suchen"), hint);
	await fireEvent.press(screen.getByRole("checkbox", { name: hint }));
}

describe("homework creation", () => {
	test.each([
		"ios",
		"android",
	] as const)("saves homework on %s", async (platform) => {
		jest.replaceProperty(Platform, "OS", platform);
		mockParams = {
			type: "homework",
			subject: "Englisch",
			dayKey: "2026-10-24",
		};
		const screen = await render(<NewEntryScreen />);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(screen.getByText("Erledigen")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(mockCreateEntry).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "Hausaufgabe",
				subject: "Englisch",
				time: "16:00",
				durationMinutes: 30,
			}),
		);
		expect(mockRouter.replace).toHaveBeenCalledWith(
			expect.stringContaining("/entry/success?"),
		);
	});

	test("announces a pending save, blocks duplicate presses and lets a failed save be retried", async () => {
		mockParams = { type: "homework", subject: "Englisch" };
		let rejectSave!: (error: Error) => void;
		mockCreateEntry.mockImplementationOnce(
			() =>
				new Promise<string>((_resolve, reject) => {
					rejectSave = reject;
				}),
		);
		const screen = await render(<NewEntryScreen />);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		const saving = screen.getByRole("button", {
			name: "Hausaufgabe wird gespeichert",
			busy: true,
		});
		expect(saving).toBeDisabled();
		await fireEvent.press(saving);
		expect(mockCreateEntry).toHaveBeenCalledTimes(1);
		await act(() =>
			rejectSave(new Error("Bitte wähle einen freien Zeitraum.")),
		);
		expect(
			screen.getByText("Bitte wähle einen freien Zeitraum."),
		).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(mockCreateEntry).toHaveBeenCalledTimes(2);
		expect(mockRouter.replace).toHaveBeenCalledWith(
			expect.stringContaining("/entry/success?"),
		);
	});
});

describe("exam creation across the topics boundary", () => {
	test.each([
		"topicDescription",
		"teacherGuidance",
	])("continues with saved topics instead of the stale %s route value", async (legacyParam) => {
		const saved =
			"Buchhaltung, Inventur, Belege, Inventar, Vermögen\nBilanz ohne Hilfsmittel";
		mockParams = {
			learningPlanId: "plan-1",
			step: "topic",
			subject: "Rechnungswesen",
			[legacyParam]: "Alter Themenstand aus dem Link",
		};
		mockSnapshot = { plan: { topicDescription: saved }, documents: [] };
		const screen = await render(<NewLearningPlanScreen />);
		await openHints(screen);
		expectHints(screen, saved);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(mockUpdateRequiredTopics).toHaveBeenCalledWith({
			id: "plan-1",
			topicDescription: saved,
			topicItems: [],
			topicAdditionalInfo: saved,
		});
	});

	test("waits for the saved draft before enabling its topic editor and search", async () => {
		mockParams = {
			learningPlanId: "plan-1",
			step: "topic",
			topicDescription: "Alter Themenstand aus dem Link",
		};
		const screen = await render(<NewLearningPlanScreen />);
		expect(screen.queryByLabelText("Hinweise suchen")).toBeNull();
		expect(screen.getByLabelText("Themen suchen")).toHaveProp(
			"editable",
			false,
		);
		expect(
			screen.getByRole("button", { name: "Weiter, wird geladen" }),
		).toBeDisabled();
		expect(mockUpdateRequiredTopics).not.toHaveBeenCalled();
		mockSnapshot = {
			plan: { topicDescription: "Genetik und Vererbung" },
			documents: [],
		};
		await screen.rerender(<NewLearningPlanScreen />);
		await openHints(screen);
		expectHints(screen, "Genetik und Vererbung");
		expect(screen.getByLabelText("Hinweise suchen")).toHaveProp(
			"editable",
			true,
		);
		expect(screen.getByLabelText("Hinweise suchen")).toHaveProp(
			"editable",
			true,
		);
		expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();
	});

	test("saves an appended accounting suggestion with the full scope before pausing", async () => {
		const original =
			"Buchhaltung, Inventur, Belege, Inventar, Vermögen\nOhne Hilfsmittel";
		mockParams = {
			learningPlanId: "plan-1",
			step: "topic",
			subject: "Rechnungswesen",
		};
		mockSnapshot = { plan: { topicDescription: original }, documents: [] };
		mockSearchTopics.mockResolvedValue({
			topics: [{ id: "bilanz", title: "Bilanz" }],
			truncated: false,
		});
		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"Bilanz",
		);
		await waitFor(() =>
			expect(
				screen.getByRole("checkbox", { name: "Bilanz" }),
			).toBeOnTheScreen(),
		);
		await fireEvent.press(screen.getByRole("checkbox", { name: "Bilanz" }));
		await act(() => mockProgress.onClose());
		await act(() => mockPauseProps.onConfirm());
		await waitFor(() =>
			expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans"),
		);
		expect(mockUpdateRequiredTopics).toHaveBeenCalledWith({
			id: "plan-1",
			topicDescription: `Bilanz\n${original}`,
			topicItems: ["Bilanz"],
			topicAdditionalInfo: original,
		});
	});

	test("saves appended search results with the full list and restores it on back navigation", async () => {
		const original =
			"Analytische Geometrie ohne Hilfsmittel\nVektoren und ihre Beträge\nSpiegeln an Ebenen und Achsen\nSkalarprodukt und Winkel";
		mockParams = {
			learningPlanId: "plan-1",
			examDayEntryId: "exam-1",
			step: "topic",
			subject: "Mathematik",
		};
		mockSnapshot = { plan: { topicDescription: original }, documents: [] };
		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "Gerad");
		await waitFor(() =>
			expect(
				screen.getByRole("checkbox", { name: "Geraden" }),
			).toBeOnTheScreen(),
		);
		await fireEvent.press(screen.getByRole("checkbox", { name: "Geraden" }));
		const complete = `Geraden\n${original}`;
		await openHints(screen);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(mockUpdateRequiredTopics).toHaveBeenCalledWith({
			id: "plan-1",
			topicDescription: complete,
			topicItems: ["Geraden"],
			topicAdditionalInfo: original,
		});
		await act(() => mockProgress.onBack());
		await openHints(screen);
		expectHints(screen, original);
	});
	test.each([
		{
			platform: "ios" as const,
			initialLabel: "Weiter mit 30. September 2026",
			selectedLabel: "Weiter mit 2. November 2026",
		},
		{
			platform: "android" as const,
			initialLabel: "Weiter",
			selectedLabel: "Weiter",
		},
	])("carries an inline calendar selection into topics and back on $platform", async ({
		platform,
		initialLabel,
		selectedLabel,
	}) => {
		jest.replaceProperty(Platform, "OS", platform);
		let screen = await render(<NewEntryScreen />);
		expect(mockProgress.currentStep).toBe(2);
		expect(
			screen.getByRole("button", { name: initialLabel }),
		).toBeOnTheScreen();
		await fireEvent(
			screen.getByTestId("inline-calendar"),
			"change",
			new Date(2026, 10, 2, 15, 30),
		);
		expect(
			screen.getByRole("button", { name: selectedLabel }),
		).toBeOnTheScreen();
		await fireEvent.press(
			screen.getByRole("button", { name: /^Weiter(?: mit .+)?$/ }),
		);
		expect(followReplacement()).toBe("/learning-plans/new");
		expect(mockParams.examDateKey).toBe("2026-11-02");
		await screen.unmount();
		screen = await render(<NewLearningPlanScreen />);
		await act(() => mockProgress.onBack());
		expect(followReplacement()).toBe("/entry/new");
		await screen.unmount();
		screen = await render(<NewEntryScreen />);
		expect(
			screen.getByRole("button", { name: selectedLabel }),
		).toBeOnTheScreen();
		expect(screen.getByTestId("inline-calendar").props.value).toEqual(
			new Date(2026, 10, 2),
		);
	});

	test.each([
		"available",
		"missing",
		"occupied",
	])("continues directly from date to topics with %s availability", async (status) => {
		mockAvailability.status = status;
		const screen = await render(<NewEntryScreen />);
		expect(screen.queryByText("Ist genug Lernzeit eingeplant?")).toBeNull();
		await fireEvent.press(
			screen.getByRole("button", { name: /^Weiter(?: mit .+)?$/ }),
		);
		expect(followReplacement()).toBe("/learning-plans/new");
	});

	test("returns from topics to the date and can continue again with the same exam", async () => {
		let screen = await render(<NewEntryScreen />);
		expect(mockProgress.currentStep).toBe(2);
		await fireEvent.press(
			screen.getByRole("button", { name: /^Weiter(?: mit .+)?$/ }),
		);
		expect(followReplacement()).toBe("/learning-plans/new");
		await screen.unmount();
		screen = await render(<NewLearningPlanScreen />);
		expect(mockProgress.currentStep).toBe(3);
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"Zellteilung und Mitose",
		);
		await fireEvent.press(
			screen.getByRole("checkbox", { name: "Zellteilung und Mitose" }),
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
		await fireEvent.press(
			screen.getByRole("button", { name: /^Weiter(?: mit .+)?$/ }),
		);
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
		await fireEvent.press(
			screen.getByRole("button", { name: /^Weiter(?: mit .+)?$/ }),
		);
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
		expect(mockProgress.currentStep).toBe(1.5);
		await fireEvent.press(screen.getByRole("radio", { name: "Chemie" }));
		await fireEvent.press(
			screen.getByRole("button", { name: /^Weiter(?: mit .+)?$/ }),
		);
		mockUpdateEntry.mockRejectedValueOnce(
			new Error("Speichern fehlgeschlagen"),
		);
		await fireEvent.press(
			screen.getByRole("button", { name: /^Weiter(?: mit .+)?$/ }),
		);
		expect(screen.getByText("Speichern fehlgeschlagen")).toBeOnTheScreen();
		expect(mockRouter.replace).not.toHaveBeenCalled();
		await fireEvent.press(
			screen.getByRole("button", { name: /^Weiter(?: mit .+)?$/ }),
		);
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

	test("closes exam setup from a later step without stepping backward", async () => {
		await render(<NewEntryScreen />);
		expect(mockProgress.currentStep).toBe(2);
		await act(() => mockProgress.onClose());
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/home");
		expect(mockProgress.currentStep).toBe(2);
	});

	test("closes unsaved topics to the saved exam instead of reopening the date step", async () => {
		mockParams = {
			examDayEntryId: "exam-1",
			fromExamEntry: "true",
			step: "topic",
		};
		await render(<NewLearningPlanScreen />);
		await act(() => mockProgress.onClose());
		expect(mockRouter.dismissTo).toHaveBeenCalledWith("/entry/exam-1");
		expect(mockRouter.replace).not.toHaveBeenCalled();
	});

	test("confirms pausing when closing directly from material upload", async () => {
		mockParams = {
			learningPlanId: "plan-1",
			examDayEntryId: "exam-1",
			step: "material",
		};
		mockSnapshot = {
			plan: { topicDescription: "Zellteilung und Mitose" },
			documents: [],
		};
		await render(<NewLearningPlanScreen />);
		await act(() => mockProgress.onClose());
		expect(mockPauseVisible).toBe(true);
		expect(mockRouter.setParams).not.toHaveBeenCalled();
		expect(mockRouter.dismissTo).not.toHaveBeenCalled();
	});

	test("saves edited draft topics before confirming pause and leaving", async () => {
		mockParams = {
			learningPlanId: "plan-1",
			examDayEntryId: "exam-1",
			step: "topic",
		};
		mockSnapshot = {
			plan: { topicDescription: "Zellteilung und Mitose" },
			documents: [],
		};
		let finishSave!: () => void;
		mockUpdateRequiredTopics.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finishSave = resolve;
				}),
		);
		const screen = await render(<NewLearningPlanScreen />);
		await openHints(screen);
		await replaceHints(screen, "Genetik und Vererbung");
		await act(() => mockProgress.onClose());
		await act(() => {
			mockPauseProps.onConfirm();
			mockPauseProps.onConfirm();
		});
		expect(mockUpdateRequiredTopics).toHaveBeenCalledTimes(1);
		expect(mockUpdateRequiredTopics).toHaveBeenCalledWith({
			id: "plan-1",
			topicDescription: "Genetik und Vererbung",
			topicItems: [],
			topicAdditionalInfo: "Genetik und Vererbung",
		});
		expect(mockPauseProps.isBusy).toBe(true);
		expect(mockRouter.dismissTo).not.toHaveBeenCalled();
		await act(() => finishSave());
		await waitFor(() =>
			expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans"),
		);
		expect(mockRouter.dismissTo).toHaveBeenCalledTimes(1);
	});

	test("keeps edited topics and the pause sheet when saving fails", async () => {
		mockParams = {
			learningPlanId: "plan-1",
			examDayEntryId: "exam-1",
			step: "topic",
		};
		mockSnapshot = {
			plan: { topicDescription: "Zellteilung und Mitose" },
			documents: [],
		};
		mockUpdateRequiredTopics.mockRejectedValueOnce(
			new Error("Speichern fehlgeschlagen"),
		);
		const screen = await render(<NewLearningPlanScreen />);
		await openHints(screen);
		await replaceHints(screen, "Genetik und Vererbung");
		await act(() => mockProgress.onClose());
		await act(() => mockPauseProps.onConfirm());
		await waitFor(() => expect(mockPauseProps.errorMessage).toBeTruthy());
		expect(mockPauseVisible).toBe(true);
		expect(mockRouter.dismissTo).not.toHaveBeenCalled();
		expectHints(screen, "Genetik und Vererbung");
		await act(() => mockPauseProps.onConfirm());
		await waitFor(() =>
			expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans"),
		);
		expect(mockUpdateRequiredTopics).toHaveBeenCalledTimes(2);
	});

	test("pauses an unchanged draft without rewriting its saved topics", async () => {
		mockParams = {
			learningPlanId: "plan-1",
			examDayEntryId: "exam-1",
			step: "material",
		};
		mockSnapshot = {
			plan: { topicDescription: "Zellteilung und Mitose" },
			documents: [],
		};
		await render(<NewLearningPlanScreen />);
		await act(() => mockProgress.onClose());
		await act(() => mockPauseProps.onConfirm());
		await waitFor(() =>
			expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans"),
		);
		expect(mockUpdateRequiredTopics).not.toHaveBeenCalled();
	});

	test("does not overwrite newer saved topics from stale route params on pause", async () => {
		mockParams = {
			learningPlanId: "plan-1",
			examDayEntryId: "exam-1",
			step: "topic",
			topicDescription: "Alter Themenstand aus dem Link",
		};
		mockSnapshot = {
			plan: { topicDescription: "Neue gespeicherte Prüfungsthemen" },
			documents: [],
		};
		await render(<NewLearningPlanScreen />);
		await act(() => mockProgress.onClose());
		await act(() => mockPauseProps.onConfirm());
		await waitFor(() =>
			expect(mockRouter.dismissTo).toHaveBeenCalledWith("/learning-plans"),
		);
		expect(mockUpdateRequiredTopics).not.toHaveBeenCalled();
	});

	test("keeps an invalid local edit rather than discarding it when pausing", async () => {
		mockParams = {
			learningPlanId: "plan-1",
			examDayEntryId: "exam-1",
			step: "topic",
		};
		mockSnapshot = {
			plan: { topicDescription: "Zellteilung und Mitose" },
			documents: [],
		};
		const screen = await render(<NewLearningPlanScreen />);
		await openHints(screen);
		await replaceHints(screen, "");
		await act(() => mockProgress.onClose());
		await act(() => mockPauseProps.onConfirm());
		await waitFor(() => expect(mockPauseProps.errorMessage).toBeTruthy());
		expect(mockPauseVisible).toBe(true);
		expect(mockUpdateRequiredTopics).not.toHaveBeenCalled();
		expect(mockRouter.dismissTo).not.toHaveBeenCalled();
		expectHints(screen, "");
	});

	test("uploads gallery photos without library-wide permission", async () => {
		mockRequestMediaLibraryPermissions.mockResolvedValue({ granted: false });
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
					fileName: null,
					fileSize: 2_048,
					mimeType: "image/png",
					uri: "file:///mitschrift-2.png",
				},
			],
		});

		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.press(
			screen.getAllByRole("button", { name: "Schulmaterial hinzufügen" })[0],
		);
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Galerie. Vorhandene Fotos auswählen",
			}),
		);

		await waitFor(() => {
			expect(mockRegisterUploadedDocument).toHaveBeenCalledTimes(2);
		});
		expect(mockRequestMediaLibraryPermissions).not.toHaveBeenCalled();
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
				fileName: expect.stringMatching(/^galerie-\d+-2\.png$/),
				fileType: "image/png",
				learningPlanId: "plan-1",
				sourceKind: "school",
			}),
		);
	});

	test.each([
		[
			"image/heic",
			[0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63],
		],
		[
			"image/avif",
			[0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66],
		],
		[undefined, [0, 0, 0, 0]],
	])("rejects unsupported or unknown exported bytes for picker MIME type %s before any upload", async (mimeType, header) => {
		mockFiles["file:///unsupported"] = { size: 1_024, header };
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
					fileName: "valid.jpg",
					fileSize: 1024,
					mimeType: "image/jpeg",
					uri: "file:///valid.jpg",
				},
				{
					fileName: null,
					fileSize: 1024,
					mimeType,
					uri: "file:///unsupported",
				},
			],
		});

		const screen = await render(<NewLearningPlanScreen />);
		await fireEvent.press(
			screen.getAllByRole("button", { name: "Schulmaterial hinzufügen" })[0],
		);
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Galerie. Vorhandene Fotos auswählen",
			}),
		);

		await waitFor(() => {
			expect(
				screen.getByText(
					"Dieser Bildtyp wird nicht unterstützt. Bitte nutze JPEG, PNG oder WebP.",
				),
			).toBeOnTheScreen();
		});
		expect(mockGenerateUploadUrl).not.toHaveBeenCalled();
		expect(mockFetch).not.toHaveBeenCalled();
		expect(mockRegisterUploadedDocument).not.toHaveBeenCalled();
	});

	test.each([
		["worksheet.HEIC", "image/jpeg"],
		["worksheet.HEIC", "image/heic"],
		["worksheet.webp", "image/webp"],
	])("uploads JPEG output with a consistent name and MIME type for %s", async (fileName, mimeType) => {
		mockFiles["file:///exported.webp"] = { size: 90_280, header: JPEG_HEADER };
		await selectGalleryPhotos([
			{ fileName, mimeType, fileSize: 43_536, uri: "file:///exported.webp" },
		]);
		await waitFor(() =>
			expect(mockRegisterUploadedDocument).toHaveBeenCalledTimes(1),
		);
		expect(mockFetch).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ headers: { "Content-Type": "image/jpeg" } }),
		);
		expect(mockRegisterUploadedDocument).toHaveBeenCalledWith(
			expect.objectContaining({
				fileName: "worksheet.jpg",
				fileType: "image/jpeg",
				fileSizeBytes: 90_280,
			}),
		);
	});

	test.each([
		["image/jpeg", "jpg", JPEG_HEADER, null],
		["image/jpeg", "jpg", JPEG_HEADER, undefined],
		["image/png", "png", PNG_HEADER, null],
		["image/png", "png", PNG_HEADER, undefined],
		["image/webp", "webp", WEBP_HEADER, null],
		["image/webp", "webp", WEBP_HEADER, undefined],
	])("uploads verified %s bytes without picker MIME metadata", async (fileType, extension, header, mimeType) => {
		mockFiles["file:///exported"] = { size: 1_024, header };
		await selectGalleryPhotos([
			{
				fileName: "worksheet.HEIC",
				mimeType,
				fileSize: 1_024,
				uri: "file:///exported",
			},
		]);
		await waitFor(() =>
			expect(mockRegisterUploadedDocument).toHaveBeenCalledTimes(1),
		);
		expect(mockFetch).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ headers: { "Content-Type": fileType } }),
		);
		expect(mockRegisterUploadedDocument).toHaveBeenCalledWith(
			expect.objectContaining({ fileName: `worksheet.${extension}`, fileType }),
		);
	});

	test("keeps genuine WebP output labeled as WebP", async () => {
		mockFiles["file:///exported.webp"] = { size: 43_536, header: WEBP_HEADER };
		await selectGalleryPhotos([
			{
				fileName: "worksheet.JPG",
				mimeType: "image/webp",
				fileSize: 43_536,
				uri: "file:///exported.webp",
			},
		]);
		await waitFor(() =>
			expect(mockRegisterUploadedDocument).toHaveBeenCalledTimes(1),
		);
		expect(mockRegisterUploadedDocument).toHaveBeenCalledWith(
			expect.objectContaining({
				fileName: "worksheet.webp",
				fileType: "image/webp",
			}),
		);
	});

	test.each([
		6_247_134,
		7 * 1024 * 1024,
	])("accepts a %s-byte export even when the original exceeds the limit", async (size) => {
		mockFiles["file:///compressed.jpg"] = { size, header: JPEG_HEADER };
		await selectGalleryPhotos([
			{
				fileName: "large.jpg",
				mimeType: "image/jpeg",
				fileSize: 20_240_594,
				uri: "file:///compressed.jpg",
			},
		]);
		await waitFor(() =>
			expect(mockRegisterUploadedDocument).toHaveBeenCalledTimes(1),
		);
		expect(mockRegisterUploadedDocument).toHaveBeenCalledWith(
			expect.objectContaining({ fileSizeBytes: size }),
		);
	});

	test.each([
		[
			7 * 1024 * 1024 + 1,
			"Die Datei ist mit 7.00 MiB zu groß (maximal 7 MiB).",
		],
		[0, "Die Datei ist leer oder konnte nicht gelesen werden."],
	])("rejects the entire batch when the actual export size is %s", async (size, message) => {
		mockFiles["file:///invalid.jpg"] = { size, header: JPEG_HEADER };
		const screen = await selectGalleryPhotos([
			{
				fileName: "valid.jpg",
				mimeType: "image/jpeg",
				fileSize: 1_024,
				uri: "file:///valid.jpg",
			},
			{
				fileName: "invalid.jpg",
				mimeType: "image/jpeg",
				fileSize: 1_024,
				uri: "file:///invalid.jpg",
			},
		]);
		await waitFor(() => expect(screen.getByText(message)).toBeOnTheScreen());
		expect(mockGenerateUploadUrl).not.toHaveBeenCalled();
		expect(mockFetch).not.toHaveBeenCalled();
		expect(mockRegisterUploadedDocument).not.toHaveBeenCalled();
	});

	test.each([
		[0x47, 0x49, 0x46, 0x38],
		[0xff, 0xd8],
	])("rejects unrecognized output bytes despite an accepted MIME type", async (...header) => {
		mockFiles["file:///invalid.jpg"] = { size: 1_024, header };
		const screen = await selectGalleryPhotos([
			{
				fileName: "invalid.jpg",
				mimeType: "image/jpeg",
				fileSize: 1_024,
				uri: "file:///invalid.jpg",
			},
		]);
		await waitFor(() =>
			expect(
				screen.getByText(
					"Dieser Bildtyp wird nicht unterstützt. Bitte nutze JPEG, PNG oder WebP.",
				),
			).toBeOnTheScreen(),
		);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	test("recovers from an unreadable export without leaving its file open", async () => {
		mockFiles["file:///unreadable.jpg"] = {
			size: 1_024,
			header: JPEG_HEADER,
			readError: "Foto konnte nicht gelesen werden.",
		};
		const screen = await selectGalleryPhotos([
			{
				fileName: "worksheet.jpg",
				mimeType: "image/jpeg",
				fileSize: 1_024,
				uri: "file:///unreadable.jpg",
			},
		]);
		await waitFor(() =>
			expect(
				screen.getByText("Foto konnte nicht gelesen werden."),
			).toBeOnTheScreen(),
		);
		expect(mockCloseFile).toHaveBeenCalledTimes(1);
		expect(mockFetch).not.toHaveBeenCalled();
		mockFiles["file:///unreadable.jpg"].readError = undefined;
		await fireEvent.press(
			screen.getAllByRole("button", { name: "Schulmaterial hinzufügen" })[0],
		);
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Galerie. Vorhandene Fotos auswählen",
			}),
		);
		await waitFor(() =>
			expect(mockRegisterUploadedDocument).toHaveBeenCalledTimes(1),
		);
	});
});

test("saves an own topic straight from the search with independent notes and restores both", async () => {
	mockParams = { learningPlanId: "plan-1", step: "topic" };
	mockSnapshot = {
		plan: {
			topicDescription: "",
			topicItems: [],
			topicAdditionalInfo: "Ohne Taschenrechner",
		},
		documents: [],
	};
	const screen = await render(<NewLearningPlanScreen />);
	await fireEvent.changeText(
		screen.getByLabelText("Themen suchen"),
		"Kostenstellenrechnung",
	);
	await fireEvent.press(
		screen.getByRole("checkbox", { name: "Kostenstellenrechnung" }),
	);
	await openHints(screen);
	await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
	expect(mockUpdateRequiredTopics).toHaveBeenCalledWith({
		id: "plan-1",
		topicItems: ["Kostenstellenrechnung"],
		topicAdditionalInfo: "Ohne Taschenrechner",
		topicDescription: "Kostenstellenrechnung\nOhne Taschenrechner",
	});
	await screen.unmount();
	mockSnapshot = {
		plan: {
			topicDescription: "Kostenstellenrechnung\nOhne Taschenrechner",
			topicItems: ["Kostenstellenrechnung"],
			topicAdditionalInfo: "Ohne Taschenrechner",
		},
		documents: [],
	};
	const reopened = await render(<NewLearningPlanScreen />);
	expect(
		reopened.getByRole("button", { name: "Kostenstellenrechnung entfernen" }),
	).toBeOnTheScreen();
	await openHints(reopened);
	expectHints(reopened, "Ohne Taschenrechner");
});

test("saved choices and hints override stale route metadata across both pages", async () => {
	mockParams = {
		learningPlanId: "plan-1",
		step: "topic",
		topicItems: '["Alter Treffer"]',
		topicAdditionalInfo: "Alter Hinweis",
	};
	mockSnapshot = {
		plan: {
			topicDescription: "Bilanz\nOhne Hilfsmittel",
			topicItems: ["Bilanz"],
			topicAdditionalInfo: "Ohne Hilfsmittel",
		},
		documents: [],
	};
	const screen = await render(<NewLearningPlanScreen />);
	expect(
		screen.getByRole("button", { name: "Bilanz entfernen" }),
	).toBeOnTheScreen();
	expect(screen.queryByText("Alter Treffer")).toBeNull();
	await fireEvent.press(
		screen.getByRole("button", { name: "Bilanz entfernen" }),
	);
	await openHints(screen);
	expectHints(screen, "Ohne Hilfsmittel");
	await replaceHints(screen, "Inventur ohne Hilfsmittel");
	await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
	expect(mockUpdateRequiredTopics).toHaveBeenCalledWith({
		id: "plan-1",
		topicItems: [],
		topicAdditionalInfo: "Inventur ohne Hilfsmittel",
		topicDescription: "Inventur ohne Hilfsmittel",
	});
});

test("preserves selection boundaries and notes through the unsaved exam back route", async () => {
	mockParams = {
		examDayEntryId: "exam-1",
		fromExamEntry: "true",
		step: "topic",
		subject: "Mathematik",
		topicItems: '["Angebot, Nachfrage"]',
		topicAdditionalInfo: "Ohne Hilfsmittel",
		topicDescription: "Angebot, Nachfrage\nOhne Hilfsmittel",
	};
	const screen = await render(<NewLearningPlanScreen />);
	await act(() => mockProgress.onBack());
	const destination = mockRouter.replace.mock.calls.at(-1)?.[0] as string;
	const url = new URL(destination, "https://dayova.test");
	expect(JSON.parse(url.searchParams.get("topicItems") ?? "null")).toEqual([
		"Angebot, Nachfrage",
	]);
	expect(url.searchParams.get("topicAdditionalInfo")).toBe("Ohne Hilfsmittel");
	expect(screen.queryByLabelText("Hinweise suchen")).toBeNull();
});

test("topics then hints then material form separate pages, with Back preserving both selections", async () => {
	mockParams = {
		learningPlanId: "plan-1",
		step: "topic",
		subject: "Alter Fachname",
	};
	mockSnapshot = {
		plan: {
			subject: "Mathe LK",
			topicItems: ["Vektoren"],
			topicAdditionalInfo: "",
			topicDescription: "Vektoren",
		},
		documents: [],
	};
	const screen = await render(<NewLearningPlanScreen />);
	expect(screen.queryByLabelText("Hinweise suchen")).toBeNull();
	expect(mockProgress.currentStep).toBe(3);
	await openHints(screen);
	expect(mockProgress.currentStep).toBe(3.25);
	expect(screen.queryByLabelText("Themen suchen")).toBeNull();
	expect(screen.queryByLabelText("Hinweise zur Prüfung (optional)")).toBeNull();
	expect(mockUpdateRequiredTopics).not.toHaveBeenCalled();
	await addHint(screen, "Ohne Taschenrechner");
	const scoped = "Analysis ohne Taschenrechner, Stochastik mit Formelsammlung";
	await addHint(screen, scoped);
	await act(() => mockProgress.onBack());
	expect(mockProgress.currentStep).toBe(3);
	expect(screen.queryByLabelText("Hinweise suchen")).toBeNull();
	expect(
		screen.getByRole("button", { name: "Vektoren entfernen" }),
	).toBeOnTheScreen();
	await openHints(screen);
	expect(
		screen.getByRole("button", { name: `${scoped} entfernen` }),
	).toBeOnTheScreen();
	await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
	expect(mockUpdateRequiredTopics).toHaveBeenCalledWith({
		id: "plan-1",
		topicItems: ["Vektoren"],
		topicAdditionalInfo: `Ohne Taschenrechner\n${scoped}`,
		topicDescription: `Vektoren\nOhne Taschenrechner\n${scoped}`,
	});
	expect(screen.getByText("Schulmaterial hinzufügen")).toBeOnTheScreen();
	await act(() => mockProgress.onBack());
	expect(screen.getByLabelText("Hinweise suchen")).toBeOnTheScreen();
	expect(
		screen.getByRole("button", { name: `${scoped} entfernen` }),
	).toBeOnTheScreen();
	await act(() => mockProgress.onBack());
	expect(screen.getByLabelText("Themen suchen")).toBeOnTheScreen();
});

test("hints can be cleared and skipped without inventing requirements", async () => {
	mockParams = { learningPlanId: "plan-1", step: "topic" };
	mockSnapshot = {
		plan: {
			subject: "Deutsch",
			topicItems: ["Gedichtanalyse"],
			topicAdditionalInfo: "Textbelege mit Zeilenangaben",
			topicDescription: "Gedichtanalyse\nTextbelege mit Zeilenangaben",
		},
		documents: [],
	};
	const screen = await render(<NewLearningPlanScreen />);
	await openHints(screen);
	expect(
		screen.queryByRole("checkbox", { name: "Ohne Taschenrechner" }),
	).toBeNull();
	await fireEvent.press(
		screen.getByRole("button", {
			name: "Textbelege mit Zeilenangaben entfernen",
		}),
	);
	await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
	expect(mockUpdateRequiredTopics).toHaveBeenCalledWith({
		id: "plan-1",
		topicItems: ["Gedichtanalyse"],
		topicAdditionalInfo: "",
		topicDescription: "Gedichtanalyse",
	});
	await act(() => mockProgress.onBack());
	expect(
		screen.getByRole("checkbox", { name: "Textbelege mit Zeilenangaben" }),
	).not.toBeChecked();
	expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();
});

test("hint save failure and pause retry retain a long condition and block duplicate saves", async () => {
	mockParams = {
		learningPlanId: "plan-1",
		step: "hints",
		subject: "Mein Projektfach",
	};
	mockSnapshot = {
		plan: {
			topicItems: ["Mein Thema"],
			topicAdditionalInfo: "",
			topicDescription: "Mein Thema",
		},
		documents: [],
	};
	const screen = await render(<NewLearningPlanScreen />);
	const note = "Nur den zweiten Teil mündlich vorbereiten. ".repeat(12).trim();
	await addHint(screen, note);
	mockUpdateRequiredTopics.mockRejectedValueOnce(
		new Error("Speichern fehlgeschlagen"),
	);
	await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
	expect(screen.getByText("Speichern fehlgeschlagen")).toBeOnTheScreen();
	expect(
		screen.getByRole("button", { name: `${note} entfernen` }),
	).toBeOnTheScreen();
	expect(screen.queryByText("Schulmaterial hinzufügen")).toBeNull();
	await act(() => mockProgress.onClose());
	await act(() => mockPauseProps.onConfirm());
	expect(mockUpdateRequiredTopics).toHaveBeenLastCalledWith(
		expect.objectContaining({
			topicAdditionalInfo: note,
			topicItems: ["Mein Thema"],
		}),
	);
	expect(mockRouter.dismissTo).toHaveBeenCalled();
});
