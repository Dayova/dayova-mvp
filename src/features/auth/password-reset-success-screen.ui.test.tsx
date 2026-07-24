import type { ReactNode } from "react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import PasswordResetSuccessScreen from "~/app/password-reset-success";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
	useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("~/components/ui/screen", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		Screen: ({ children }: { children: ReactNode }) =>
			React.createElement(Native.View, null, children),
	};
});

jest.mock("~/components/ui/themed-status-bar", () => ({
	ThemedStatusBar: () => null,
}));

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ bottom: 24, left: 0, right: 0, top: 24 }),
}));

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		Check: (props: Record<string, unknown>) =>
			React.createElement("Icon", props),
	};
});

describe("password reset success", () => {
	beforeEach(() => {
		mockReplace.mockClear();
	});

	test("explains session invalidation before continuing home", async () => {
		const screen = await render(<PasswordResetSuccessScreen />);

		expect(screen.getByText("Passwort gespeichert")).toBeOnTheScreen();
		expect(
			screen.getByText("Alle anderen Geräte wurden abgemeldet."),
		).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Fertig" }));
		expect(mockReplace).toHaveBeenCalledWith("/home");
	});
});
