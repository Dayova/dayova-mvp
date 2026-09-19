import { beforeEach, expect, jest, test } from "@jest/globals";
import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import type { ComponentProps } from "react";
import type { ConfirmationSheet } from "~/components/ui/confirmation-sheet";
import { FirstPlanPrompt } from "./first-plan-prompt";

const mockResolve = jest.fn<(args: { choice: string }) => Promise<boolean>>();
const mockPush = jest.fn();
let mockPending: boolean | undefined = true;
let mockStatus = "none";
let mockCanUseApp = true;

jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useQuery: (_api: unknown, args: unknown) =>
		args === "skip" ? undefined : mockPending,
	useMutation: () => mockResolve,
}));
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
	useFocusEffect: (effect: () => void) =>
		require("react").useEffect(effect, [effect]),
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({
		user: { clerkId: "learner" },
		onboardingCompletionStatus: mockStatus,
		isPostAuthSyncing: false,
	}),
}));
jest.mock("~/context/AccessContext", () => ({
	useAccess: () => ({
		access: { canUseApp: mockCanUseApp },
		isAccessLoading: false,
	}),
}));
jest.mock("~/components/ui/confirmation-sheet", () => ({
	ConfirmationSheet: (props: ComponentProps<typeof ConfirmationSheet>) => {
		const { View, Text, Pressable } = require("react-native");
		if (!props.visible) return null;
		return (
			<View>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={props.confirmLabel}
					disabled={props.isBusy}
					onPress={props.onConfirm}
				>
					<Text>{props.confirmLabel}</Text>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={props.cancelLabel}
					disabled={props.isBusy}
					onPress={props.onClose}
				>
					<Text>{props.cancelLabel}</Text>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Schließen"
					onPress={props.onClose}
				/>
				{props.errorMessage ? <Text>{props.errorMessage}</Text> : null}
			</View>
		);
	},
}));

beforeEach(() => {
	jest.clearAllMocks();
	mockResolve.mockResolvedValue(true);
	mockPending = true;
	mockStatus = "none";
	mockCanUseApp = true;
});

test("starts the existing exam flow only after the choice is saved", async () => {
	await render(<FirstPlanPrompt />);
	await fireEvent.press(
		screen.getByRole("button", { name: "Jetzt Lernplan erstellen" }),
	);
	await waitFor(() =>
		expect(mockResolve).toHaveBeenCalledWith({ choice: "create" }),
	);
	expect(mockPush).toHaveBeenCalledWith("/entry/new?type=exam");
	expect(
		screen.queryByRole("button", { name: "Jetzt Lernplan erstellen" }),
	).toBeNull();
});

test.each([
	"Erstmal die App anschauen",
	"Schließen",
])("%s persists dismissal without navigating", async (label) => {
	await render(<FirstPlanPrompt />);
	await fireEvent.press(screen.getByRole("button", { name: label }));
	expect(mockResolve).toHaveBeenCalledWith({ choice: "explore" });
	expect(mockPush).not.toHaveBeenCalled();
});

test.each([
	undefined,
	false,
])("does not display when eligibility is %s", async (value) => {
	mockPending = value;
	await render(<FirstPlanPrompt />);
	expect(
		screen.queryByRole("button", { name: "Jetzt Lernplan erstellen" }),
	).toBeNull();
});

test("waits for onboarding and access", async () => {
	mockStatus = "pending";
	const result = await render(<FirstPlanPrompt />);
	expect(
		screen.queryByRole("button", { name: "Jetzt Lernplan erstellen" }),
	).toBeNull();
	mockStatus = "none";
	mockCanUseApp = false;
	await result.rerender(<FirstPlanPrompt />);
	expect(
		screen.queryByRole("button", { name: "Jetzt Lernplan erstellen" }),
	).toBeNull();
});

test("a failed save keeps the popup available for retry", async () => {
	mockResolve.mockRejectedValueOnce(new Error("offline"));
	await render(<FirstPlanPrompt />);
	await fireEvent.press(
		screen.getByRole("button", { name: "Jetzt Lernplan erstellen" }),
	);
	expect(
		await screen.findByText(/Deine Auswahl konnte nicht gespeichert/),
	).toBeTruthy();
	expect(mockPush).not.toHaveBeenCalled();
	await fireEvent.press(
		screen.getByRole("button", { name: "Jetzt Lernplan erstellen" }),
	);
	expect(mockPush).toHaveBeenCalledTimes(1);
});

test("a stale prompt cannot start a second plan after another device handles it", async () => {
	mockResolve.mockResolvedValue(false);
	await render(<FirstPlanPrompt />);
	await fireEvent.press(
		screen.getByRole("button", { name: "Jetzt Lernplan erstellen" }),
	);
	expect(mockPush).not.toHaveBeenCalled();
});
