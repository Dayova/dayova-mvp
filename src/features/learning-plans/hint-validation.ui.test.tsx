import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import HintValidationScreen from "~/app/hint-validation";
import {
	readHintVariant,
	useHintVariant,
	writeHintVariant,
} from "./hint-validation-preference";

const mockReplace = jest.fn();
jest.mock("~/components/ui/screen", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	const Screen = ({ children }: { children: import("react").ReactNode }) =>
		React.createElement(View, null, children);
	return { Screen, ScreenScroll: Screen };
});
let mockStored: string | null = null;
let mockStorageFailure = false;
jest.mock("expo-router", () => ({
	useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("expo-application", () => ({ applicationId: "com.dayova.dev" }));
jest.mock("expo-secure-store", () => ({
	getItemAsync: async () => {
		if (mockStorageFailure) throw new Error("Unavailable");
		return mockStored;
	},
	setItemAsync: async (_key: string, value: string) => {
		if (mockStorageFailure) throw new Error("Unavailable");
		mockStored = value;
	},
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { primary: "#00A0E6", text: "#111111", secondaryText: "#697586" },
	}),
}));

beforeEach(() => {
	mockReplace.mockClear();
	mockStored = null;
	mockStorageFailure = false;
});

test("moderator persists the chosen placement before opening the ordinary creation flow", async () => {
	const screen = await render(<HintValidationScreen />);
	await fireEvent.press(
		screen.getByRole("button", { name: "Extraansicht: neue Prüfung" }),
	);
	await waitFor(() =>
		expect(mockReplace).toHaveBeenCalledWith("/entry/new?type=exam"),
	);
	expect(await readHintVariant()).toBe("extra");
	await screen.unmount();
	const reopened = await render(<HintValidationScreen />);
	await fireEvent.press(
		reopened.getByRole("button", { name: "Inline: Entwurf öffnen" }),
	);
	await waitFor(() =>
		expect(mockReplace).toHaveBeenLastCalledWith("/learning-plans"),
	);
	expect(await readHintVariant()).toBe("inline");
});

test("storage failure leaves the moderator on a retryable choice instead of launching the wrong variant", async () => {
	mockStorageFailure = true;
	const screen = await render(<HintValidationScreen />);
	await fireEvent.press(
		screen.getByRole("button", { name: "Extraansicht: neue Prüfung" }),
	);
	await waitFor(() => expect(screen.getByRole("alert")).toBeOnTheScreen());
	expect(mockReplace).not.toHaveBeenCalled();
	mockStorageFailure = false;
	await fireEvent.press(
		screen.getByRole("button", { name: "Extraansicht: neue Prüfung" }),
	);
	await waitFor(() => expect(mockReplace).toHaveBeenCalled());
});

function Assignment() {
	const { variant, error } = useHintVariant();
	return <Text>{error ? "error" : (variant ?? "loading")}</Text>;
}

test("the running session freezes its assignment; a fresh mount reads the new assignment", async () => {
	await writeHintVariant("extra");
	const screen = await render(<Assignment />);
	await waitFor(() => expect(screen.getByText("extra")).toBeOnTheScreen());
	await act(() => writeHintVariant("inline"));
	await screen.rerender(<Assignment />);
	expect(screen.getByText("extra")).toBeOnTheScreen();
	await screen.unmount();
	const next = await render(<Assignment />);
	await waitFor(() => expect(next.getByText("inline")).toBeOnTheScreen());
});

test("an unreadable assignment is explicit and never silently falls back", async () => {
	mockStorageFailure = true;
	const screen = await render(<Assignment />);
	await waitFor(() => expect(screen.getByText("error")).toBeOnTheScreen());
});
