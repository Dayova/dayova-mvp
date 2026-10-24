import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	test,
} from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Component, type ReactNode, useState } from "react";
import { Text } from "react-native";
import { DayovaThemeProvider } from "~/lib/theme";
import { AiConsentProvider } from "./AiConsentContext";
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
const mockPosthog = {
	reset: jest.fn(),
	identify: jest.fn(),
	capture: jest.fn(),
};
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
let mockProtectedQueryError: Error | null = null;

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
	useQuery: (_query: unknown, args: unknown) => {
		if (args === "skip") return undefined;
		if (mockProtectedQueryError) throw mockProtectedQueryError;
		return { status: "notSet", hasCurrentConsent: false, updatedAt: null };
	},
}));
jest.mock("~/features/privacy/ai-consent-sheet", () => ({
	AiConsentSheet: () => null,
}));
jest.mock("~/lib/open-external-url", () => ({ openExternalUrl: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }),
}));
jest.mock("posthog-react-native", () => ({ usePostHog: () => mockPosthog }));
jest.mock("~/context/OnboardingContext", () => ({
	useOnboarding: () => ({ clearAnswers: jest.fn() }),
}));
jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));
jest.mock("~/lib/runtime-config", () => ({
	get env() {
		return mockEnv ?? {};
	},
}));
jest.mock("~/lib/pending-onboarding-sync-secure-store", () => ({
	getOnboardingAccountFingerprint: async () => "test-fingerprint",
	pendingOnboardingSyncOutbox: { resume: async () => ({ status: "none" }) },
}));

function Probe() {
	const { deleteAccount } = useAccountActions();
	const { user, isConvexUserSynced } = useAuthSession();
	const [message, setMessage] = useState("");
	if (!user) return <Text>Signed out</Text>;
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
		<DayovaThemeProvider>
			<AuthProvider>
				<Probe />
			</AuthProvider>
		</DayovaThemeProvider>,
	);
	await waitFor(() => expect(screen.getByText("ready")).toBeOnTheScreen());
	await fireEvent.press(screen.getByText("Delete account"));
	return screen;
};

describe("account deletion through AuthContext", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockSignOut.mockReset().mockResolvedValue(undefined);
		mockProtectedQueryError = null;
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

	test("survives protected subscription invalidation while deletion is being accepted", async () => {
		class AppCrashBoundary extends Component<
			{ children: ReactNode },
			{ crashed: boolean }
		> {
			state = { crashed: false };
			static getDerivedStateFromError() {
				return { crashed: true };
			}
			render() {
				return this.state.crashed ? (
					<Text>App crashed</Text>
				) : (
					this.props.children
				);
			}
		}
		const app = () => (
			<DayovaThemeProvider>
				<AppCrashBoundary>
					<AuthProvider>
						<AiConsentProvider>
							<Probe />
						</AiConsentProvider>
					</AuthProvider>
				</AppCrashBoundary>
			</DayovaThemeProvider>
		);
		let accept!: (response: Response) => void;
		mockFetch.mockImplementationOnce(
			() =>
				new Promise<Response>((resolve) => {
					accept = resolve;
				}),
		);
		const screen = await render(app());
		await waitFor(() => expect(screen.getByText("ready")).toBeOnTheScreen());
		await fireEvent.press(screen.getByText("Delete account"));
		await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
		// Convex can deliver the committed tombstone before the HTTP response.
		mockProtectedQueryError = new Error(
			"Dieses Konto wird dauerhaft gelöscht.",
		);
		const diagnostic = jest
			.spyOn(console, "error")
			.mockImplementation(() => {});
		try {
			await screen.rerender(app());
			await act(async () =>
				accept({
					ok: true,
					json: async () => ({ status: "accepted", requestId: "test-request" }),
				} as Response),
			);
			expect(screen.queryByText("App crashed")).toBeNull();
			await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
			expect(await screen.findByText("Signed out")).toBeOnTheScreen();
		} finally {
			diagnostic.mockRestore();
		}
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

	test("localizes an uncertain request timeout and offers sign-out recovery", async () => {
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
		expect(screen.queryByText("ready")).toBeNull();
		await fireEvent.press(
			screen.getByRole("button", { name: "Zur Anmeldung" }),
		);
		expect(await screen.findByText("Signed out")).toBeOnTheScreen();
	});

	test("keeps accepted deletion isolated when sign-out fails and retries only sign-out", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ status: "accepted", requestId: "test-request" }),
		} as Response);
		mockSignOut.mockRejectedValueOnce(new Error("offline"));
		const screen = await attemptDeletion();
		expect(await screen.findByText("Löschauftrag erhalten")).toBeOnTheScreen();
		expect(screen.queryByText("ready")).toBeNull();
		await fireEvent.press(
			screen.getByRole("button", { name: "Zur Anmeldung" }),
		);
		expect(await screen.findByText("Signed out")).toBeOnTheScreen();
		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockSignOut).toHaveBeenCalledTimes(2);
	});

	test.each([
		[403, "Das aktuelle Passwort ist falsch."],
		[429, "Zu viele Versuche. Bitte versuche es später erneut."],
		[503, "Server error: Die Passwortprüfung ist nicht verfügbar."],
		[500, "Die Kontolöschung konnte nicht bestätigt werden."],
	])("preserves HTTP %s server messages without generic remapping", async (status, error) => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status,
			json: async () => ({ error }),
		} as Response);
		const screen = await attemptDeletion();
		expect(await screen.findByText(error)).toBeOnTheScreen();
		expect(mockSignOut).not.toHaveBeenCalled();
		if (status < 500) {
			await fireEvent.press(screen.getByRole("button", { name: "Zurück" }));
			expect(await screen.findByText("ready")).toBeOnTheScreen();
		} else {
			expect(
				screen.getByRole("button", { name: "Zur Anmeldung" }),
			).toBeOnTheScreen();
			expect(screen.queryByText("ready")).toBeNull();
		}
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
