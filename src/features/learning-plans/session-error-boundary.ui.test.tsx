import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { ConvexError } from "convex/values";
import { Try } from "expo-router/build/views/Try";
import type { ReactNode } from "react";
import LearningSessionContentScreen, {
	ErrorBoundary,
} from "~/app/learning-plans/[planId]/sessions/[sessionId]";

const mockQuery = jest.fn<() => unknown>();
const mockMutation = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockAction = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockDismissTo = jest.fn();
const mockRouter = { dismissTo: mockDismissTo };
let mockParams: { planId?: string; sessionId?: string; returnTo?: string };

jest.mock("expo-router", () => ({
	Stack: { Screen: () => null },
	useRouter: () => mockRouter,
	useLocalSearchParams: () => mockParams,
}));
jest.mock("expo-router/build/views/Splash", () => ({ hideAsync: jest.fn() }));
jest.mock("convex/react", () => ({
	useQuery: () => mockQuery(),
	useConvexAuth: () => ({ isAuthenticated: true }),
	useMutation: () => mockMutation,
	useAction: () => mockAction,
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { clerkId: "test" } }),
}));
jest.mock("~/context/AiConsentContext", () => ({
	useAiConsent: () => ({ requestAiConsent: async () => true }),
}));
jest.mock("~/lib/use-validation-analytics", () => ({
	useValidationAnalytics: () => ({ capture: jest.fn() }),
}));
jest.mock("~/lib/theme", () => ({ useDayovaTheme: () => ({ colors: {} }) }));
jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));
jest.mock("~/lib/safe-haptics", () => ({ triggerSuccessHaptic: jest.fn() }));
jest.mock("~/lib/navigation", () => ({
	dismissToOrReplace: (router: typeof mockRouter, target: string) =>
		router.dismissTo(target),
	useBackIntent: jest.fn(),
}));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("~/components/ui/button", () => {
	const { Pressable } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return { Button: Pressable, BackButton: Pressable };
});
jest.mock("~/components/ui/text", () => ({
	Text: jest.requireActual<typeof import("react-native")>("react-native").Text,
}));
jest.mock("~/components/ui/error-message", () => ({
	ErrorMessage:
		jest.requireActual<typeof import("react-native")>("react-native").Text,
}));
jest.mock("~/components/ui/screen", () => {
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return { Screen: View, ScreenScroll: View };
});
jest.mock("~/components/ui/themed-status-bar", () => ({
	ThemedStatusBar: () => null,
}));
jest.mock("~/components/ui/icon", () => ({ Timer: () => null }));
jest.mock("~/components/ui/textarea", () => ({ Textarea: () => null }));
jest.mock("~/components/screen-header", () => ({ ScreenHeader: () => null }));
jest.mock("~/components/question-progress-bar", () => ({
	QuestionProgressBar: () => null,
}));
jest.mock("./choice-list", () => ({ ChoiceList: () => null }));
jest.mock("./learning-session-completion", () => ({
	LearningSessionCompletion: () => null,
}));
jest.mock("./session-feedback", () => ({ FeedbackView: () => null }));
jest.mock("./theory-topic-page", () => ({ TheoryTopicPage: () => null }));

function SessionRoute({ children }: { children?: ReactNode }) {
	return (
		<Try catch={ErrorBoundary}>
			{children ?? <LearningSessionContentScreen />}
		</Try>
	);
}

beforeEach(() => {
	mockParams = {
		planId: "plan_1",
		sessionId: "session_1",
		returnTo: "/analyse?planId=plan_1",
	};
	mockQuery.mockReset();
	mockMutation.mockReset();
	mockAction.mockReset().mockResolvedValue({ itemCount: 1 });
	mockDismissTo.mockClear();
	jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
	jest.restoreAllMocks();
});

for (const message of [
	"Dieser Lernblock ist nur eine Vorschau und kann sich noch ändern.",
	"Lernblock nicht gefunden.",
]) {
	test(`contains a render-query failure: ${message}`, async () => {
		mockQuery.mockImplementation(() => {
			throw new ConvexError({ kind: "userFacing", message });
		});
		const screen = await render(<SessionRoute />);
		expect(screen.getByText("Lernblock nicht verfügbar")).toBeTruthy();
		expect(screen.getByText(message)).toBeTruthy();
		expect(
			screen.getByText("Dein gespeicherter Lernfortschritt bleibt erhalten."),
		).toBeTruthy();
		await fireEvent.press(screen.getByText("Zurück"));
		expect(mockDismissTo).toHaveBeenCalledWith("/analyse?planId=plan_1");
		expect(mockMutation).not.toHaveBeenCalled();
		expect(mockAction).not.toHaveBeenCalled();
	});
}

test("retry recovers the actual route when the query becomes available", async () => {
	mockQuery.mockImplementation(() => {
		throw new Error("[CONVEX Q] Server Error: private detail");
	});
	const screen = await render(<SessionRoute />);
	expect(screen.queryByText(/private detail/)).toBeNull();
	mockQuery.mockReturnValue(undefined);
	await fireEvent.press(screen.getByText("Erneut versuchen"));
	expect(screen.queryByText("Lernblock nicht verfügbar")).toBeNull();
	expect(screen.getByText("Dein Lernblock wird vorbereitet")).toBeTruthy();
});

test("retry of a still-unavailable query remains recoverable and back falls back to the plan", async () => {
	mockParams.returnTo = undefined;
	mockQuery.mockImplementation(() => {
		throw new Error("invalid session id");
	});
	const screen = await render(<SessionRoute />);
	await fireEvent.press(screen.getByText("Erneut versuchen"));
	expect(screen.getByText("Lernblock nicht verfügbar")).toBeTruthy();
	await fireEvent.press(screen.getByText("Zurück"));
	expect(mockDismissTo).toHaveBeenCalledWith("/learning-plans/plan_1");
	expect(mockMutation).not.toHaveBeenCalled();
});
