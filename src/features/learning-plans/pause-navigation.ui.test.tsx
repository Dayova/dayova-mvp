import { beforeEach, expect, jest, test } from "@jest/globals";
import { act } from "@testing-library/react-native";
import { Stack } from "expo-router";
import {
	fireEvent,
	renderRouter,
	screen,
	testRouter,
	waitFor,
} from "expo-router/testing-library";
import { Text } from "react-native";
import NewLearningPlanScreen from "~/app/(creation)/learning-plans/new";

let mockClose: () => void;
let mockParams: Record<string, string>;
const mockSave = jest.fn<(_args: Record<string, unknown>) => Promise<void>>();

jest.mock("react-native-keyboard-controller", () => {
	const { View, ScrollView } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		KeyboardStickyView: View,
		KeyboardAwareScrollView: ScrollView,
		useKeyboardState: () => false,
	};
});
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useMutation: (reference: unknown) => {
		const { getFunctionName } =
			jest.requireActual<typeof import("convex/server")>("convex/server");
		return getFunctionName(
			reference as Parameters<typeof getFunctionName>[0],
		) === "learningPlans:createDraft"
			? async () => "plan-native-pause"
			: mockSave;
	},
	useAction: () => async () => ({ topics: [], truncated: false }),
	useQuery: () => ({
		plan: {
			topicDescription: "Bilanz\nOhne Hilfsmittel",
			topicItems: ["Bilanz"],
			topicAdditionalInfo: "Ohne Hilfsmittel",
		},
		documents: [],
	}),
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { clerkId: "native-pause-test" } }),
}));
jest.mock("~/features/learning-plans/creation-progress-shell", () => ({
	useLearningPlanCreationProgress: (config: { onClose: () => void }) => {
		mockClose = config.onClose;
	},
}));
jest.mock("~/components/ui/confirmation-sheet", () => {
	const { Button, Text, View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		ConfirmationSheet: ({
			visible,
			onConfirm,
			errorMessage,
		}: {
			visible: boolean;
			onConfirm: () => void;
			errorMessage?: string;
		}) =>
			visible ? (
				<View>
					<Button title="Später fortsetzen" onPress={onConfirm} />
					<Text>{errorMessage}</Text>
				</View>
			) : null,
	};
});
jest.mock("~/components/ui/action-sheet", () => ({
	ActionSheet: () => null,
	actionSheetIconColor: "#000000",
}));
jest.mock("~/components/ui/screen", () => {
	const native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return { Screen: native.View, ScreenScroll: native.ScrollView };
});
jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);
	return new Proxy({}, { get: () => Icon });
});
jest.mock("react-native-reanimated/mock", () =>
	jest.requireActual("../../../tests/mocks/selection-reanimated.cjs"),
);
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { text: "#000000", primary: "#00A0E6" } }),
}));
jest.mock("~/lib/use-validation-analytics", () => ({
	useValidationAnalytics: () => ({ capture: jest.fn() }),
}));
jest.mock("~/lib/analytics", () => ({
	getValidationFileSizeBucket: jest.fn(),
}));
jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));
jest.mock("expo-file-system", () => ({ File: class {} }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-image-picker", () => ({}));

// Exercise the SDK 58 router and its actual removal guard rather than the
// retired React Navigation container/protection context.
const Overview = () => <Text>Lernplanübersicht</Text>;
async function renderCreation() {
	return renderRouter(
		{
			_layout: {
				default: () => <Stack />,
				unstable_settings: { anchor: "learning-plans/index" },
			},
			"learning-plans/index": Overview,
			"creation/_layout": () => <Stack />,
			"creation/index": NewLearningPlanScreen,
			"entry/[entryId]": () => <Text>Gespeicherte Prüfung</Text>,
			"entry/success": () => <Text>Prüfung erstellt</Text>,
		},
		{ initialUrl: `/creation?${new URLSearchParams(mockParams)}` },
	);
}

beforeEach(() => {
	jest.clearAllMocks();
	mockSave.mockResolvedValue(undefined);
	mockParams = {
		learningPlanId: "plan-native-pause",
		subject: "Rechnungswesen",
		step: "topic",
	};
});

test("confirmed pause leaves the real guarded route for the overview", async () => {
	const result = await renderCreation();
	expect(result.getPathname()).toBe("/creation");
	await act(() => mockClose());
	await fireEvent.press(screen.getByText("Später fortsetzen"));
	await waitFor(() => expect(result.getPathname()).toBe("/learning-plans"));
	expect(screen.getByText("Lernplanübersicht")).toBeVisible();
	expect(screen.queryByLabelText("Hinweise suchen")).toBeNull();
});

test("pause keeps native protection until edited topics have saved", async () => {
	let finishSave: () => void = () => undefined;
	mockSave.mockImplementation(
		() =>
			new Promise<void>((resolve) => {
				finishSave = resolve;
			}),
	);
	const result = await renderCreation();
	await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
	await fireEvent.changeText(
		screen.getByLabelText("Hinweise suchen"),
		"Auch Inventur.",
	);
	await fireEvent.press(
		screen.getByRole("checkbox", {
			name: "Auch Inventur.",
		}),
	);
	await act(() => mockClose());
	await fireEvent.press(screen.getByText("Später fortsetzen"));
	expect(result.getPathname()).toBe("/creation");
	await testRouter.back();
	expect(result.getPathname()).toBe("/creation");
	expect(screen.getByLabelText("Hinweise suchen")).toBeOnTheScreen();
	await act(() => finishSave());
	await waitFor(() => expect(result.getPathname()).toBe("/learning-plans"));
	expect(screen.getByText("Lernplanübersicht")).toBeVisible();
	expect(mockSave).toHaveBeenCalledWith({
		id: "plan-native-pause",
		topicItems: ["Bilanz"],
		topicAdditionalInfo: "Ohne Hilfsmittel\nAuch Inventur.",
		topicDescription: "Bilanz\nOhne Hilfsmittel\nAuch Inventur.",
	});
});

test("failed pause retains the route, native protection and edited text", async () => {
	mockSave.mockRejectedValue(new Error("offline"));
	const result = await renderCreation();
	await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
	await fireEvent.changeText(
		screen.getByLabelText("Hinweise suchen"),
		"Auch Inventur.",
	);
	await fireEvent.press(
		screen.getByRole("checkbox", {
			name: "Auch Inventur.",
		}),
	);
	await act(() => mockClose());
	await fireEvent.press(screen.getByText("Später fortsetzen"));
	expect(result.getPathname()).toBe("/creation");
	expect(screen.getByText("Auch Inventur.")).toBeOnTheScreen();
	expect(screen.getByText("Ohne Hilfsmittel")).toBeOnTheScreen();
	expect(screen.getByText("offline")).toBeOnTheScreen();
});

test("the deliberate material-later replacement is allowed while back stays protected", async () => {
	mockParams = {
		examDayEntryId: "exam-native-pause",
		subject: "Rechnungswesen",
		topicDescription: "Bilanz",
		step: "topic",
	};
	const result = await renderCreation();
	await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
	expect(result.getPathname()).toBe("/creation");
	await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
	await fireEvent.press(screen.getByText("Ohne Lernmaterial erstellen"));
	await waitFor(() => expect(result.getPathname()).toBe("/entry/success"));
	expect(screen.getByText("Prüfung erstellt")).toBeVisible();
	expect(screen.queryByText("Schulmaterial hinzufügen")).toBeNull();
});

test("closing unsaved setup leaves the nested guarded stack for its saved exam", async () => {
	mockParams = {
		examDayEntryId: "exam-native-close",
		subject: "Rechnungswesen",
		topicDescription: "Bilanz",
		step: "topic",
	};
	const result = await renderCreation();
	await act(() => mockClose());
	await waitFor(() =>
		expect(result.getPathname()).toBe("/entry/exam-native-close"),
	);
	expect(screen.getByText("Gespeicherte Prüfung")).toBeVisible();
	expect(screen.queryByLabelText("Themen suchen")).toBeNull();
});
