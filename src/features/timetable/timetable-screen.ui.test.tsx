import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import TimetableScreen from "../../app/timetable";

const mockPickFile = jest.fn<() => Promise<unknown>>();
const mockCameraPermission = jest.fn<() => Promise<unknown>>();
const mockCamera = jest.fn<() => Promise<unknown>>();
const mockMutation = jest.fn<() => Promise<string>>();
const mockConsent = jest.fn<() => Promise<boolean>>();
let mockAuthenticated = true;
let mockState: unknown;
let mockDismiss: (() => void) | undefined;
let mockStackSources = false;

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
}));

jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: mockAuthenticated }),
	useQuery: () => mockState,
	useMutation: () => mockMutation,
	useAction: () => jest.fn(),
}));
jest.mock("expo-router", () => ({
	useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
}));
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));
jest.mock("expo-file-system", () => ({ File: jest.fn() }));
jest.mock("expo-document-picker", () => ({
	getDocumentAsync: () => mockPickFile(),
}));
jest.mock("expo-image-picker", () => ({
	requestCameraPermissionsAsync: () => mockCameraPermission(),
	launchCameraAsync: () => mockCamera(),
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { _id: "learner" } }),
}));
jest.mock("~/context/AiConsentContext", () => ({
	useAiConsent: () => ({ requestAiConsent: mockConsent }),
}));
jest.mock("~/features/learning-plans/utils", () => ({
	getUploadFailureMessage: jest.fn(),
}));
jest.mock("~/lib/user-facing-errors", () => ({
	getUserFacingErrorMessage: (error: Error) => error.message,
}));
jest.mock("~/components/ui/date-time-picker-sheet", () => ({
	DateTimePickerSheet: () => null,
}));
jest.mock("~/components/ui/select-sheet", () => ({ SelectSheet: () => null }));
jest.mock("~/components/ui/themed-status-bar", () => ({
	ThemedStatusBar: () => null,
}));
jest.mock("~/components/ui/portrait-content", () => {
	const actual = jest.requireActual<
		typeof import("~/components/ui/portrait-content")
	>("~/components/ui/portrait-content");
	return {
		...actual,
		useContentSizeLayout: () => ({
			horizontalPadding: 24,
			shouldStackInlineContent: mockStackSources,
		}),
	};
});
jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);
	return {
		ArrowLeft: Icon,
		Attachment: Icon,
		CalendarDays: Icon,
		Check: Icon,
		Plus: Icon,
		ScanImage: Icon,
	};
});
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			background: "#F6F6F4",
			text: "#1A1A1A",
			primaryStrong: "#00A0E6",
		},
	}),
}));
jest.mock("~/components/ui/screen", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	const Container = ({ children }: { children: ReactNode }) =>
		React.createElement(View, null, children);
	return { Screen: Container, ScreenScroll: Container };
});
// Retain real ActionSheet options; control only the native close-animation boundary.
jest.mock("~/components/ui/dayova-sheet-frame", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { View, Pressable, Text } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		DayovaSheetFrame: ({
			visible,
			onClose,
			onDismiss,
			children,
			contentClassName,
		}: {
			visible: boolean;
			onClose: () => void;
			onDismiss?: () => void;
			children: ReactNode;
			contentClassName: string;
		}) => {
			mockDismiss = onDismiss;
			return visible
				? React.createElement(
						View,
						{ testID: "sources", className: contentClassName },
						children,
						React.createElement(
							Pressable,
							{
								accessibilityRole: "button",
								accessibilityLabel: "Auswahl schließen",
								onPress: onClose,
							},
							React.createElement(Text, null, "Schließen"),
						),
					)
				: null;
		},
	};
});

const importName = "Stundenplan importieren";
const manualName = "Unterrichtsstunde manuell hinzufügen";

describe("Timetable import entry", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockAuthenticated = true;
		mockStackSources = false;
		mockState = { draft: null, active: null };
		mockDismiss = undefined;
		mockPickFile.mockResolvedValue({ canceled: true });
		mockCameraPermission.mockResolvedValue({ granted: true });
		mockCamera.mockResolvedValue({ canceled: true });
		mockMutation.mockResolvedValue("draft");
		mockConsent.mockResolvedValue(true);
	});

	test("offers import and manual entry while source choices stay inside the sheet", async () => {
		const screen = await render(<TimetableScreen />);
		expect(screen.getByRole("button", { name: importName })).toBeEnabled();
		expect(screen.getByRole("button", { name: manualName })).toBeEnabled();
		expect(screen.queryByRole("button", { name: "Dateien" })).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: importName }));
		expect(screen.getByRole("button", { name: "Scannen" })).toBeEnabled();
		expect(screen.getByRole("button", { name: "Dateien" })).toBeEnabled();
		expect(mockPickFile).not.toHaveBeenCalled();
	});

	test.each([
		"Dateien",
		"Scannen",
	])("opens %s only after dismissal and consumes the selection once", async (source) => {
		const screen = await render(<TimetableScreen />);
		await fireEvent.press(screen.getByRole("button", { name: importName }));
		await fireEvent.press(screen.getByRole("button", { name: source }));
		expect(mockPickFile).not.toHaveBeenCalled();
		expect(mockCameraPermission).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: manualName })).toBeDisabled();
		expect(screen.getByRole("button", { name: importName })).toBeDisabled();
		await act(async () => {
			mockDismiss?.();
			mockDismiss?.();
		});
		expect(
			source === "Dateien" ? mockPickFile : mockCamera,
		).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("button", { name: importName })).toBeEnabled();
		expect(mockMutation).not.toHaveBeenCalled();
		expect(mockConsent).not.toHaveBeenCalled();
	});

	test("closing without choosing launches nothing and allows reopening", async () => {
		const screen = await render(<TimetableScreen />);
		await fireEvent.press(screen.getByRole("button", { name: importName }));
		await fireEvent.press(
			screen.getByRole("button", { name: "Auswahl schließen" }),
		);
		await act(() => mockDismiss?.());
		expect(mockPickFile).not.toHaveBeenCalled();
		expect(mockCameraPermission).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("button", { name: importName }));
		expect(screen.getByRole("button", { name: "Dateien" })).toBeEnabled();
	});

	test("keeps import busy and manual entry disabled until the picker returns", async () => {
		let finishSelection: ((result: unknown) => void) | undefined;
		mockPickFile.mockImplementation(
			() =>
				new Promise((resolve) => {
					finishSelection = resolve;
				}),
		);
		const screen = await render(<TimetableScreen />);
		await fireEvent.press(screen.getByRole("button", { name: importName }));
		await fireEvent.press(screen.getByRole("button", { name: "Dateien" }));
		await act(() => mockDismiss?.());
		expect(
			screen.getByRole("button", { name: importName }).props.accessibilityState,
		).toEqual({ busy: true, disabled: true });
		await fireEvent.press(screen.getByRole("button", { name: manualName }));
		expect(mockMutation).not.toHaveBeenCalled();
		await act(async () => finishSelection?.({ canceled: true }));
		expect(screen.getByRole("button", { name: importName })).toBeEnabled();
		expect(screen.getByRole("button", { name: manualName })).toBeEnabled();
	});

	test("camera denial leaves file import and manual entry usable", async () => {
		mockCameraPermission.mockResolvedValue({ granted: false });
		const screen = await render(<TimetableScreen />);
		await fireEvent.press(screen.getByRole("button", { name: importName }));
		await fireEvent.press(screen.getByRole("button", { name: "Scannen" }));
		await act(async () => mockDismiss?.());
		expect(mockCamera).not.toHaveBeenCalled();
		expect(
			screen.getByText(
				"Erlaube den Kamerazugriff, um deinen Stundenplan zu fotografieren.",
			),
		).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: manualName })).toBeEnabled();
		await fireEvent.press(screen.getByRole("button", { name: importName }));
		await fireEvent.press(screen.getByRole("button", { name: "Dateien" }));
		await act(async () => mockDismiss?.());
		expect(mockPickFile).toHaveBeenCalledTimes(1);
	});

	test("manual entry creates a draft directly without opening import or requesting AI consent", async () => {
		const screen = await render(<TimetableScreen />);
		await fireEvent.press(screen.getByRole("button", { name: manualName }));
		expect(mockMutation).toHaveBeenCalledTimes(1);
		expect(mockConsent).not.toHaveBeenCalled();
		expect(screen.queryByTestId("sources")).toBeNull();
	});

	test.each([
		"loading",
		"signed-out",
		"processing",
	])("prevents competing entry actions while %s", async (state) => {
		if (state === "loading") mockState = undefined;
		if (state === "signed-out") mockAuthenticated = false;
		if (state === "processing")
			mockState = {
				draft: { id: "draft", status: "processing", lessons: [] },
				active: null,
			};
		const screen = await render(<TimetableScreen />);
		for (const name of [importName, manualName]) {
			const button = screen.getByRole("button", { name });
			expect(button).toBeDisabled();
			await fireEvent.press(button);
		}
		expect(mockMutation).not.toHaveBeenCalled();
		expect(screen.queryByTestId("sources")).toBeNull();
	});

	test("uses source rows when content size needs more space", async () => {
		mockStackSources = true;
		const screen = await render(<TimetableScreen />);
		await fireEvent.press(screen.getByRole("button", { name: importName }));
		expect(screen.getByTestId("sources").props.className).toBe("gap-3");
		expect(screen.getByRole("button", { name: "Dateien" })).toBeEnabled();
	});
});
