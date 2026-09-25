import { expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import LearningPlanReviewScreen from "~/app/learning-plans/[planId]/review";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		resolvedTheme: "light",
		colors: { text: "#1A1A1A" },
	}),
}));

jest.mock("expo-router", () => ({
	Stack: { Screen: () => null },
	useLocalSearchParams: () => ({ planId: "plan_1" }),
	useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock("~/lib/navigation", () => ({ useBackIntent: jest.fn() }));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { clerkId: "user_1" } }),
}));
jest.mock("#convex/_generated/api", () => ({
	api: {
		learningPlans: {
			acceptPlan: "accept",
			getPlanDetails: "details",
			listSessions: "sessions",
		},
	},
}));
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useMutation: () => jest.fn(),
	useQuery: (name: string) =>
		name === "details"
			? {
					status: "generated",
					diagnosticPlacement: "firstSession",
					learningTimeSuggestion: {
						initialPromptDismissed: false,
						entries: [{ dayOfWeek: 1, startTime: "16:00", endTime: "20:00" }],
					},
				}
			: [
					{
						id: "session_1",
						title: "Wissenscheck",
						sessionPurpose: "diagnostic",
						dateLabel: "24. September",
						startTime: "17:00",
						durationMinutes: 20,
					},
				],
}));
jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	const Icon = () => React.createElement(Native.View);
	return {
		CalendarDays: Icon,
		Check: Icon,
		Route2: Icon,
		Sparkles: Icon,
		Time04: Icon,
		ChevronLeft: Icon,
		ArrowLeft: Icon,
	};
});
jest.mock("~/components/ui/screen", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	const Wrapper = ({ children }: { children: import("react").ReactNode }) =>
		React.createElement(Native.View, null, children);
	return { Screen: Wrapper, ScreenScroll: Wrapper };
});

test("lets the learner start the first session without a learning-time question", async () => {
	const screen = await render(<LearningPlanReviewScreen />);
	expect(
		screen.getByRole("button", { name: "Lernschritt starten" }),
	).toBeEnabled();
	expect(screen.queryByText("Vorgeschlagene Lernzeiten")).toBeNull();
	expect(screen.queryByText("Zeiten übernehmen")).toBeNull();
	expect(screen.queryByText("Jetzt anpassen")).toBeNull();
});
