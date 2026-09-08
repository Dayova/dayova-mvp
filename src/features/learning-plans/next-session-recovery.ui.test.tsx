import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { Id } from "#convex/_generated/dataModel";
import { NextSessionRecovery } from "./next-session-recovery";

const mockRestore = jest.fn<() => Promise<boolean>>();
const mockPush = jest.fn();
jest.mock("~/components/ui/icon", () => ({ ArrowLeft: () => null }));
jest.mock("convex/react", () => ({ useMutation: () => mockRestore }));
jest.mock("#convex/_generated/api", () => ({
	api: { learningPlans: { restoreNextSession: "restore" } },
}));
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
	useFocusEffect: (callback: () => void) => {
		const React = jest.requireActual<typeof import("react")>("react");
		React.useEffect(callback, [callback]);
	},
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { primary: "#00BAFF" } }),
}));

beforeEach(() => {
	mockRestore.mockReset();
	mockPush.mockClear();
});

test("restores on opening and shows accessible busy state", async () => {
	mockRestore.mockReturnValue(new Promise(() => {}));
	const screen = await render(
		<NextSessionRecovery planId={"plan_1" as Id<"learningPlans">} />,
	);
	expect(mockRestore).toHaveBeenCalledWith({ learningPlanId: "plan_1" });
	expect(
		screen.getByLabelText("Nächster Lernschritt wird geplant"),
	).toBeOnTheScreen();
});

test("offers learning times when no slot is available", async () => {
	mockRestore.mockResolvedValue(false);
	const screen = await render(
		<NextSessionRecovery planId={"plan_1" as Id<"learningPlans">} />,
	);
	await waitFor(() =>
		expect(screen.getByText("Lernzeiten anpassen")).toBeOnTheScreen(),
	);
	await fireEvent.press(screen.getByText("Lernzeiten anpassen"));
	expect(mockPush).toHaveBeenCalledWith("/learning-times");
});

test("retries failures and prevents duplicate requests while retrying", async () => {
	mockRestore.mockRejectedValueOnce(new Error("offline"));
	const screen = await render(
		<NextSessionRecovery planId={"plan_1" as Id<"learningPlans">} />,
	);
	await waitFor(() =>
		expect(screen.getByText("Erneut versuchen")).toBeOnTheScreen(),
	);
	mockRestore.mockReturnValue(new Promise(() => {}));
	const button = screen.getByText("Erneut versuchen");
	await act(async () => {
		await fireEvent.press(button);
	});
	expect(mockRestore).toHaveBeenCalledTimes(2);
	expect(screen.queryByText("Erneut versuchen")).toBeNull();
	expect(
		screen.getByLabelText("Nächster Lernschritt wird geplant"),
	).toBeOnTheScreen();
});
