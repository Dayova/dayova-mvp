import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import HintValidationScreen from "~/app/hint-validation";

jest.mock("react-native-reanimated", () =>
	jest.requireActual("../../../tests/mocks/selection-reanimated.cjs"),
);
jest.mock("expo-constants", () => ({ expoConfig: { extra: {} } }));
jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);
	return new Proxy({}, { get: () => Icon });
});
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

test("opens the single two-page flow without reading or writing an old placement preference", async () => {
	mockStored = "inline";
	mockStorageFailure = true;
	const screen = await render(<HintValidationScreen />);
	expect(screen.queryByText("Inline: neue Prüfung")).toBeNull();
	await fireEvent.press(screen.getByRole("button", { name: "Neue Prüfung" }));
	await waitFor(() =>
		expect(mockReplace).toHaveBeenCalledWith("/entry/new?type=exam"),
	);
	expect(mockStored).toBe("inline");
	await fireEvent.press(screen.getByRole("button", { name: "Entwurf öffnen" }));
	expect(mockReplace).toHaveBeenLastCalledWith("/learning-plans");
});
