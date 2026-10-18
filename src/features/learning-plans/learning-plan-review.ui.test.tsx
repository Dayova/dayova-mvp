import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import Review from "~/app/learning-plans/[planId]/review";

const mockRouter = { replace: jest.fn() };
let mockStatus = "generated";
const mockAccept = jest.fn(async () => {
	mockStatus = "accepted";
	return "diagnostic_1";
});
jest.mock("expo-router", () => ({
	useLocalSearchParams: () => ({ planId: "plan_1" }),
	useRouter: () => mockRouter,
}));
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useQuery: () => ({
		plan: {
			status: mockStatus,
			preparationState: "diagnostic",
			examDateKey: "2026-12-31",
		},
		sessions: [
			{ id: "diagnostic_1", dateKey: "2026-12-01", startTime: "17:00" },
		],
	}),
	useMutation: () => mockAccept,
}));
jest.mock("#convex/_generated/api", () => ({
	api: {
		learningPlans: {
			getSnapshot: "snapshot",
			acceptDiagnostic: "accept",
			acceptPlan: "legacy",
		},
	},
}));
jest.mock("~/features/learning-plans/preparation-slot-editor", () => ({
	PreparationSlotEditor: () => null,
}));
jest.mock("~/components/ui/icon", () => ({ Time04: () => null }));
jest.mock("~/components/ui/screen", () => {
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return { Screen: View, ScreenScroll: View };
});
jest.mock("~/components/ui/text", () => {
	const { Text } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return { Text };
});
jest.mock("~/components/ui/button", () => {
	const { Pressable } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return { Button: Pressable, BackButton: () => null };
});
beforeEach(() => {
	mockRouter.replace.mockClear();
	mockAccept.mockClear();
	mockStatus = "generated";
});
test("acceptance subscription cannot redirect the immediate start back to the plan", async () => {
	const screen = await render(<Review />);
	await fireEvent.press(screen.getByText("Jetzt starten"));
	await waitFor(() =>
		expect(mockRouter.replace).toHaveBeenCalledWith(
			"/learning-plans/plan_1/sessions/diagnostic_1",
		),
	);
	await screen.rerender(<Review />);
	expect(mockRouter.replace).not.toHaveBeenCalledWith("/learning-plans/plan_1");
});
test("reopening an already accepted plan resumes its learning path", async () => {
	mockStatus = "accepted";
	await render(<Review />);
	expect(mockRouter.replace).toHaveBeenCalledWith("/learning-plans/plan_1");
});
