import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import {
	createNavigatorFactory,
	NavigationContainer,
	StackRouter,
	useNavigationBuilder,
	usePreventRemoveContext,
} from "expo-router/react-navigation";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import NewLearningPlanScreen from "~/app/(creation)/learning-plans/new";

let mockClose: () => void;
let mockParams: Record<string, string>;
const mockSave = jest.fn<() => Promise<void>>();

jest.mock("expo-router", () => {
	const { useNavigation, StackActions } = jest.requireActual<
		typeof import("expo-router/react-navigation")
	>("expo-router/react-navigation");
	return {
		Stack: { Screen: () => null },
		useLocalSearchParams: () => mockParams,
		useRouter: () => {
			const navigation = useNavigation();
			return {
				// dismissTo removes the creation route when the overview is below it.
				dismissTo: () => navigation.dispatch(StackActions.popToTop()),
				replace: () => navigation.dispatch(StackActions.replace("Overview")),
				setParams: jest.fn(),
			};
		},
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
jest.mock("react-native-reanimated", () =>
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

function TestNavigator({ children }: { children: ReactNode }) {
	const { state, descriptors, NavigationContent } = useNavigationBuilder(
		StackRouter,
		{ children },
	);
	return (
		<NavigationContent>
			<Protection />
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

function Protection() {
	const { preventedRoutes } = usePreventRemoveContext();
	return (
		<Text testID="native-protection">
			{Object.values(preventedRoutes).some((route) => route.preventRemove)
				? "protected"
				: "unprotected"}
		</Text>
	);
}

const Stack = createNavigatorFactory(TestNavigator)();
const Overview = () => <Text>Lernplanübersicht</Text>;
const App = () => (
	<NavigationContainer
		initialState={{
			index: 1,
			routes: [{ name: "Overview" }, { name: "Creation" }],
		}}
	>
		<Stack.Navigator>
			<Stack.Screen name="Overview" component={Overview} />
			<Stack.Screen name="Creation" component={NewLearningPlanScreen} />
		</Stack.Navigator>
	</NavigationContainer>
);

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
	await render(<App />);
	expect(screen.getByTestId("native-protection")).toHaveTextContent(
		"protected",
	);
	await act(() => mockClose());
	await fireEvent.press(screen.getByText("Später fortsetzen"));
	expect(screen.getByText("Lernplanübersicht")).toBeVisible();
	expect(screen.queryByLabelText("Hinweise zur Prüfung (optional)")).toBeNull();
});

test("pause keeps native protection until edited topics have saved", async () => {
	let finishSave: () => void = () => undefined;
	mockSave.mockImplementation(
		() =>
			new Promise<void>((resolve) => {
				finishSave = resolve;
			}),
	);
	await render(<App />);
	await fireEvent.changeText(
		screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		"Ohne Hilfsmittel. Auch Inventur.",
	);
	await act(() => mockClose());
	await fireEvent.press(screen.getByText("Später fortsetzen"));
	expect(screen.getByTestId("native-protection")).toHaveTextContent(
		"protected",
	);
	expect(
		screen.getByLabelText("Hinweise zur Prüfung (optional)"),
	).toBeOnTheScreen();
	await act(() => finishSave());
	expect(screen.getByText("Lernplanübersicht")).toBeVisible();
	expect(mockSave).toHaveBeenCalledWith({
		id: "plan-native-pause",
		topicItems: ["Bilanz"],
		topicAdditionalInfo: "Ohne Hilfsmittel. Auch Inventur.",
		topicDescription: "Bilanz\nOhne Hilfsmittel. Auch Inventur.",
	});
});

test("failed pause retains the route, native protection and edited text", async () => {
	mockSave.mockRejectedValue(new Error("offline"));
	await render(<App />);
	await fireEvent.changeText(
		screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		"Ohne Hilfsmittel. Auch Inventur.",
	);
	await act(() => mockClose());
	await fireEvent.press(screen.getByText("Später fortsetzen"));
	expect(screen.getByTestId("native-protection")).toHaveTextContent(
		"protected",
	);
	expect(
		screen.getByLabelText("Hinweise zur Prüfung (optional)"),
	).toHaveDisplayValue("Ohne Hilfsmittel. Auch Inventur.");
	expect(screen.getByText("offline")).toBeOnTheScreen();
});

test("the deliberate material-later replacement is allowed while back stays protected", async () => {
	mockParams = {
		examDayEntryId: "exam-native-pause",
		subject: "Rechnungswesen",
		topicDescription: "Bilanz",
		step: "topic",
	};
	await render(<App />);
	await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
	expect(screen.getByTestId("native-protection")).toHaveTextContent(
		"protected",
	);
	await fireEvent.press(screen.getByText("Ohne Lernmaterial erstellen"));
	expect(screen.getByText("Lernplanübersicht")).toBeVisible();
	expect(screen.queryByText("Schulmaterial hinzufügen")).toBeNull();
});
