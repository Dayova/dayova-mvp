import type { ReactNode } from "react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import AuthLayout from "../../app/(auth)/_layout";

const mockRedirect = jest.fn();
const mockStackScreens: Array<{
	name: string;
	options?: Record<string, unknown>;
}> = [];
const mockSession = {
	isSessionLoading: false,
	pendingSessionTask: null as string | null,
	user: { id: "user_123" } as { id: string } | null,
};

jest.mock("expo-router", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Stack = ({ children }: { children?: ReactNode }) =>
		React.createElement("Stack", null, children);
	Stack.Screen = (props: {
		name: string;
		options?: Record<string, unknown>;
	}) => {
		mockStackScreens.push(props);
		return null;
	};

	return {
		Redirect: (props: { href: string }) => {
			mockRedirect(props.href);
			return null;
		},
		Stack,
	};
});

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => mockSession,
}));

describe("AuthLayout", () => {
	beforeEach(() => {
		mockRedirect.mockClear();
		mockStackScreens.length = 0;
		mockSession.isSessionLoading = false;
		mockSession.pendingSessionTask = null;
		mockSession.user = { id: "user_123" };
	});

	test("does not redirect a pending forced-reset session through home", async () => {
		mockSession.pendingSessionTask = "reset-password";

		await render(<AuthLayout />);

		expect(mockRedirect).not.toHaveBeenCalledWith("/home");
	});

	test("leaves settled-session navigation to the root auth guard", async () => {
		await render(<AuthLayout />);

		expect(mockRedirect).not.toHaveBeenCalled();
	});

	test("keeps the native edge-back gesture on the onboarding entry route", async () => {
		mockSession.user = null;

		await render(<AuthLayout />);

		expect(mockStackScreens).toContainEqual({
			name: "onboarding",
			options: {
				title: "Registrierung",
				gestureEnabled: true,
				fullScreenGestureEnabled: false,
			},
		});
	});
});
