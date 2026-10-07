import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { router } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";
import { Text } from "react-native";
import AppLayout from "~/app/(app)/_layout";
import AuthLayout from "~/app/(auth)/_layout";
import { AuthNavigationGate } from "~/components/auth-navigation-gate";
import { RootNavigationStack } from "~/components/root-navigation-stack";

let mockSession = {
	user: { clerkId: "user_qa" } as { clerkId: string } | null,
	isSessionLoading: false,
	pendingSessionTask: null,
	onboardingCompletionStatus: "none",
};
const mockListeners = new Set<() => void>();
jest.mock("~/context/AuthContext", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		useAuthSession: () =>
			React.useSyncExternalStore(
				(listener) => {
					mockListeners.add(listener);
					return () => mockListeners.delete(listener);
				},
				() => mockSession,
			),
	};
});
jest.mock("~/context/AccessContext", () => ({
	useAccess: () => ({ access: { state: "paid" }, isAccessLoading: false }),
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			background: "white",
			surface: "white",
			secondaryText: "gray",
			primaryStrong: "blue",
			systemSubtle: "gray",
		},
	}),
}));

const fixtures = {
	_layout: () => (
		<AuthNavigationGate>
			<RootNavigationStack />
		</AuthNavigationGate>
	),
	"(auth)/_layout": AuthLayout,
	"(auth)/index": () => <Text>Login choice</Text>,
	"(auth)/login": () => <Text>Login form</Text>,
	"(auth)/onboarding/index": () => <Text>Intro pager</Text>,
	"(auth)/onboarding/[step]": () => <Text>Registration step</Text>,
	"(auth)/onboarding/verification": () => null,
	"(auth)/onboarding/creating": () => null,
	"(app)/_layout": AppLayout,
	"(app)/home": () => <Text>Private home</Text>,
	"(app)/settings": () => <Text>Private settings</Text>,
	"(app)/learning-plans": () => <Text>Private plans</Text>,
	profile: () => <Text>Private profile</Text>,
	"change-password": () => <Text>Private password</Text>,
	subscription: () => null,
	"subscription-success": () => null,
	"learning-times/edit": () => null,
	timetable: () => null,
	"personal-subjects": () => null,
};

async function updateSession(patch: Partial<typeof mockSession>) {
	await act(() => {
		mockSession = { ...mockSession, ...patch };
		for (const listener of mockListeners) listener();
	});
	await settle();
}
async function settle() {
	await act(async () => {
		await jest.advanceTimersByTimeAsync(60);
	});
}
async function push(path: string) {
	await act(() => router.push(path as never));
	await settle();
}
const hidden = { includeHiddenElements: true };

describe("auth root history isolation with production layouts", () => {
	beforeEach(() => {
		mockSession = {
			user: { clerkId: "user_qa" },
			isSessionLoading: false,
			pendingSessionTask: null,
			onboardingCompletionStatus: "none",
		};
		mockListeners.clear();
	});
	test("successful cold restoration retains the requested settings destination", async () => {
		mockSession = { ...mockSession, user: null, isSessionLoading: true };
		await renderRouter(fixtures, { initialUrl: "/settings" });
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeTruthy();
		await updateSession({
			user: { clerkId: "user_restored" },
			isSessionLoading: false,
		});
		expect(screen.getByText("Private settings")).toBeTruthy();
		expect(screen.queryByTestId("auth-bootstrap-mask")).toBeNull();
	});
	test("authenticated settings keeps ordinary Back navigation", async () => {
		await renderRouter(fixtures, { initialUrl: "/settings" });
		await push("/profile");
		await act(() => router.back());
		await settle();
		expect(screen.getByText("Private settings")).toBeTruthy();
	});
	test("a signed-out direct intro link remains a supported public destination", async () => {
		mockSession = { ...mockSession, user: null };
		await renderRouter(fixtures, { initialUrl: "/onboarding" });
		await settle();
		expect(screen.getByText("Intro pager")).toBeTruthy();
		expect(screen.queryByTestId("auth-bootstrap-mask")).toBeNull();
	});
	test("normal profile logout masks loading then removes tabs and auth back stays public", async () => {
		await renderRouter(fixtures, { initialUrl: "/settings" });
		await push("/profile");
		expect(screen.getByText("Private profile")).toBeTruthy();
		await updateSession({ user: null, isSessionLoading: true });
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeTruthy();
		expect(
			screen.getByTestId("auth-route-content", hidden).props.pointerEvents,
		).toBe("none");
		await updateSession({ isSessionLoading: false });
		expect(await screen.findByText("Login choice")).toBeTruthy();
		expect(screen.queryByText("Private settings", hidden)).toBeNull();
		expect(screen.queryByText("Private profile", hidden)).toBeNull();
		await push("/onboarding");
		await act(() => router.back());
		await settle();
		expect(screen.getByText("Login choice")).toBeTruthy();
		expect(router.canGoBack()).toBe(false);
	});
	test("failed logout keeps the same private destination and history", async () => {
		await renderRouter(fixtures, { initialUrl: "/settings" });
		await push("/profile");
		await updateSession({ isSessionLoading: true });
		await updateSession({ isSessionLoading: false });
		expect(screen.getByText("Private profile")).toBeTruthy();
		expect(screen.queryByTestId("auth-bootstrap-mask")).toBeNull();
		await act(() => router.back());
		await settle();
		expect(screen.getByText("Private settings")).toBeTruthy();
	});
	test("two logout/relogin cycles keep each auth boundary isolated", async () => {
		await renderRouter(fixtures, { initialUrl: "/settings" });
		for (let cycle = 0; cycle < 2; cycle++) {
			await push("/profile");
			await updateSession({ user: null });
			expect(await screen.findByText("Login choice")).toBeTruthy();
			expect(screen.queryByText("Private settings", hidden)).toBeNull();
			expect(router.canGoBack()).toBe(false);
			await updateSession({ user: { clerkId: `user_cycle_${cycle}` } });
			expect(await screen.findByText("Private home")).toBeTruthy();
			await push("/settings");
		}
	});
	test.each([
		"/home",
		"/settings",
	])("signed-out %s deep link enters auth choice", async (path) => {
		mockSession = { ...mockSession, user: null };
		await renderRouter(fixtures, { initialUrl: path });
		await settle();
		expect(screen.getByText("Login choice")).toBeTruthy();
		expect(screen.queryByText("Private home", hidden)).toBeNull();
		expect(screen.queryByText("Private settings", hidden)).toBeNull();
		expect(router.canGoBack()).toBe(false);
	});
	test("failed cold restoration of settings goes to auth choice", async () => {
		mockSession = { ...mockSession, user: null, isSessionLoading: true };
		await renderRouter(fixtures, { initialUrl: "/settings" });
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeTruthy();
		await updateSession({ isSessionLoading: false });
		expect(screen.getByText("Login choice")).toBeTruthy();
		expect(screen.queryByText("Private settings", hidden)).toBeNull();
		expect(router.canGoBack()).toBe(false);
	});
	test("remote session loss across private root routes survives repeated Back", async () => {
		await renderRouter(fixtures, { initialUrl: "/settings" });
		await push("/profile");
		await push("/change-password");
		await updateSession({ user: null });
		expect(await screen.findByText("Login choice")).toBeTruthy();
		for (let attempt = 0; attempt < 3; attempt++) {
			if (router.canGoBack()) {
				await act(() => router.back());
				await settle();
			}
			expect(await screen.findByText("Login choice")).toBeTruthy();
			expect(screen.queryByTestId("auth-bootstrap-mask")).toBeNull();
			expect(screen.queryByText("Private settings", hidden)).toBeNull();
		}
		expect(router.canGoBack()).toBe(false);
	});
});
