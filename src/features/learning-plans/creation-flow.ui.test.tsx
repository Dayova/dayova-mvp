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
				mimeType: string | undefined;
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
			return { size: mockFiles[this.uri]?.size ?? 1_024 };
		}

		open() {
			return {
				readBytes: (length: number) => {
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
	mockFiles = {
		"file:///mitschrift-2.png": { size: 2_048, header: PNG_HEADER },
	};
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
		screen.getByRole("button", { name: "Schulmaterial hinzufügen" }),
	);
	await fireEvent.press(
		screen.getByRole("button", {
			name: "Galerie. Vorhandene Fotos auswählen",
		}),
	);
	return screen;
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
			screen.getByRole("button", { name: "Schulmaterial hinzufügen" }),
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
		"image/heic",
		"image/avif",
		undefined,
	])("rejects unsupported or unknown gallery MIME type %s before any upload", async (mimeType) => {
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
			screen.getByRole("button", { name: "Schulmaterial hinzufügen" }),
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
			screen.getByRole("button", { name: "Schulmaterial hinzufügen" }),
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
