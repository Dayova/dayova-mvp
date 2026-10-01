import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import LearningPlanAnalysisScreen from "~/app/(creation)/learning-plans/[planId]/analysis";

const mockRouter = {
	replace: jest.fn(),
	push: jest.fn(),
	back: jest.fn(),
	canGoBack: () => true,
};
const mockGenerateKnowledgeQuestions = jest.fn<() => Promise<never>>();
const mockRequestAiConsent = jest.fn(async () => true);
const mockSnapshot = {
	plan: {
		id: "plan-1",
		status: "draft",
		diagnosticPlacement: undefined,
		topicDescription: "Lineare Funktionen",
		topicMap: [
			{
				id: "steigung",
				title: "Steigung",
				learningGoal: "Steigungen berechnen",
				keywords: ["Steigung"],
				priority: "high",
			},
		],
		knowledgeQuestions: [],
	},
	documents: [],
	answers: [],
	sessions: [],
};

jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useAction: () => mockGenerateKnowledgeQuestions,
	useQuery: () => mockSnapshot,
}));
jest.mock("expo-router", () => ({
	useRouter: () => mockRouter,
	useLocalSearchParams: () => ({ planId: "plan-1" }),
	Stack: { Screen: () => null },
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { id: "user-1" } }),
}));
jest.mock("~/context/AiConsentContext", () => ({
	useAiConsent: () => ({ requestAiConsent: mockRequestAiConsent }),
}));
jest.mock("~/features/learning-plans/creation-progress-shell", () => ({
	useLearningPlanCreationProgress: () => undefined,
}));
jest.mock("~/lib/navigation", () => ({
	dismissToOrReplace: (router: typeof mockRouter, path: string) =>
		router.replace(path),
	goBackOrReplace: (router: typeof mockRouter, path: string) =>
		router.replace(path),
	useBackIntent: () => undefined,
}));
jest.mock("~/components/ui/animated-flower-loader", () => ({
	AnimatedFlowerLoader: () => null,
}));
jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));

describe("learning plan material-analysis recovery", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockGenerateKnowledgeQuestions.mockRejectedValue({
			data: {
				kind: "userFacing",
				code: "insufficient_material",
				message:
					"Die KI findet in deinen Unterlagen noch keine ausreichende Grundlage für den Wissenscheck. Es fehlen Aufgaben zur Berechnung der Steigung. Prüfe die Themen und ergänze oder ersetze Material.",
			},
		});
	});

	test("keeps the draft and offers direct topic, material, and retry actions", async () => {
		const screen = await render(<LearningPlanAnalysisScreen />);

		await waitFor(() =>
			expect(
				screen.getByText(
					"Die KI findet in deinen Unterlagen noch keine ausreichende Grundlage für den Wissenscheck. Es fehlen Aufgaben zur Berechnung der Steigung. Prüfe die Themen und ergänze oder ersetze Material.",
				),
			).toBeOnTheScreen(),
		);

		await fireEvent.press(
			screen.getByRole("button", { name: "Prüfungsstoff prüfen" }),
		);
		expect(mockRouter.replace).toHaveBeenCalledWith(
			"/learning-plans/plan-1/scope",
		);

		await fireEvent.press(
			screen.getByRole("button", {
				name: "Material ergänzen oder ersetzen",
			}),
		);
		expect(mockRouter.replace).toHaveBeenCalledWith(
			"/learning-plans/new?learningPlanId=plan-1&step=material",
		);

		await fireEvent.press(
			screen.getByRole("button", { name: "Erneut versuchen" }),
		);
		await waitFor(() =>
			expect(mockGenerateKnowledgeQuestions).toHaveBeenCalledTimes(2),
		);
	});

	test("keeps material editing available when the cause is unknown", async () => {
		mockGenerateKnowledgeQuestions.mockRejectedValueOnce(
			new Error("Unclassified AI failure"),
		);
		const screen = await render(<LearningPlanAnalysisScreen />);

		await waitFor(() =>
			expect(
				screen.getByText(
					"Die Ursache konnte nicht sicher erkannt werden. Deine Angaben bleiben gespeichert; du kannst es erneut versuchen oder dein Material prüfen.",
				),
			).toBeOnTheScreen(),
		);
		expect(
			screen.getByRole("button", { name: "Material ergänzen oder ersetzen" }),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Erneut versuchen" }),
		).toBeOnTheScreen();
	});
});
