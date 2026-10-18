import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	test,
} from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useState } from "react";
import { Text } from "react-native";
import { AuthProvider, useAccountActions, useAuthSession } from "./AuthContext";

const mockUser = {
	id: "user_deletion_test",
	primaryEmailAddress: { emailAddress: "deletion@example.com" },
	unsafeMetadata: {},
	fullName: "Deletion Test",
};
const mockStartVerification = jest.fn<() => Promise<unknown>>();
const mockVerifyPassword = jest.fn<() => Promise<unknown>>();
const mockGetToken = jest.fn<() => Promise<string>>();
const mockSignOut = jest.fn<() => Promise<void>>();
const mockSync = jest.fn(async () => ({}));
const mockClerk = {
	loaded: true,
	session: {
		currentTask: null,
		startVerification: mockStartVerification,
		attemptFirstFactorVerification: mockVerifyPassword,
		getToken: mockGetToken,
	},
	signOut: mockSignOut,
};
const mockEnv: { EXPO_PUBLIC_CONVEX_SITE_URL?: string } = {};
const mockFetch = jest.fn<typeof fetch>();
const originalFetch = global.fetch;

jest.mock("@clerk/expo", () => ({
	useClerk: () => mockClerk,
	useUser: () => ({ user: mockUser, isLoaded: true }),
	useSignIn: () => ({}),
	isClerkAPIResponseError: (error: { clerkError?: boolean } | null) =>
		error?.clerkError === true,
}));
jest.mock("convex/react", () => ({
	useConvex: () => ({ url: "https://test.convex.cloud" }),
	useMutation: () => mockSync,
	useConvexAuth: () => ({ isAuthenticated: true }),
}));
jest.mock("posthog-react-native", () => ({ usePostHog: () => null }));
jest.mock("~/context/OnboardingContext", () => ({
	useOnboarding: () => ({ clearAnswers: jest.fn() }),
}));
jest.mock("~/lib/analytics", () => ({ isPostHogConfigured: false }));
jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));
jest.mock("~/lib/runtime-config", () => ({
	get env() {
		return mockEnv;
	},
}));
jest.mock("~/lib/pending-onboarding-sync-secure-store", () => ({
	getOnboardingAccountFingerprint: async () => "test-fingerprint",
	pendingOnboardingSyncOutbox: { resume: async () => ({ status: "none" }) },
}));

function Probe() {
	const { deleteAccount } = useAccountActions();
	const { isConvexUserSynced } = useAuthSession();
	const [message, setMessage] = useState("");
	return (
		<>
			<Text>{isConvexUserSynced ? "ready" : "pending"}</Text>
			<Text
				onPress={() => {
					void deleteAccount("current-password").catch((error: Error) =>
						setMessage(error.message),
					);
				}}
			>
				Delete account
			</Text>
			<Text>{message}</Text>
		</>
	);
}

const attemptDeletion = async () => {
	const screen = await render(
		<AuthProvider>
			<Probe />
		</AuthProvider>,
	);
	await waitFor(() => expect(screen.getByText("ready")).toBeOnTheScreen());
	await fireEvent.press(screen.getByText("Delete account"));
	return screen;
};

describe("account deletion through AuthContext", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockEnv.EXPO_PUBLIC_CONVEX_SITE_URL = undefined;
		mockStartVerification.mockResolvedValue({
			status: "needs_first_factor",
			supportedFirstFactors: [{ strategy: "password" }],
		});
		mockVerifyPassword.mockResolvedValue({ status: "complete" });
		mockGetToken.mockResolvedValue("fresh-token");
		global.fetch = mockFetch;
		mockFetch.mockResolvedValue({
			ok: false,
			json: async () => ({ error: "Die Passwortprüfung ist nicht verfügbar." }),
		} as Response);
	});
	afterEach(() => {
		global.fetch = originalFetch;
	});

	test("describes an incorrect current password without referring to email", async () => {
		mockVerifyPassword.mockRejectedValueOnce({
			clerkError: true,
			errors: [{ code: "form_password_incorrect" }],
		});
		const screen = await attemptDeletion();
		expect(
			await screen.findByText("Das aktuelle Passwort ist falsch."),
		).toBeOnTheScreen();
		expect(mockFetch).not.toHaveBeenCalled();
		expect(mockSignOut).not.toHaveBeenCalled();
	});

	test("localizes a request timeout and preserves the session", async () => {
		mockFetch.mockRejectedValueOnce(
			Object.assign(new Error("The operation was aborted due to timeout"), {
				name: "TimeoutError",
			}),
		);
		const screen = await attemptDeletion();
		expect(
			await screen.findByText(
				"Die Kontolöschung hat zu lange gedauert. Bitte prüfe deine Verbindung und versuche es erneut.",
			),
		).toBeOnTheScreen();
		expect(mockSignOut).not.toHaveBeenCalled();
	});

	test.each([
		[403, "Das aktuelle Passwort ist falsch."],
		[429, "Zu viele Versuche. Bitte versuche es später erneut."],
		[503, "Server error: Die Passwortprüfung ist nicht verfügbar."],
	])("preserves HTTP %s server messages without generic remapping", async (status, error) => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status,
			json: async () => ({ error }),
		} as Response);
		const screen = await attemptDeletion();
		expect(await screen.findByText(error)).toBeOnTheScreen();
		expect(mockSignOut).not.toHaveBeenCalled();
	});

	test.each([
		[undefined, "https://test.convex.site/account-deletion"],
		[
			"https://configured.example.test",
			"https://configured.example.test/account-deletion",
		],
	])("uses the configured site or the deployment fallback: %s", async (site, endpoint) => {
		mockEnv.EXPO_PUBLIC_CONVEX_SITE_URL = site;
		const screen = await attemptDeletion();
		expect(
			await screen.findByText("Die Passwortprüfung ist nicht verfügbar."),
		).toBeOnTheScreen();
		expect(mockFetch).toHaveBeenCalledWith(
			endpoint,
			expect.objectContaining({ method: "POST" }),
		);
		expect(mockSignOut).not.toHaveBeenCalled();
	});
});
