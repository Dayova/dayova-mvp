import { describe, expect, jest, test } from "@jest/globals";
import { router, Stack } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";
import { Text } from "react-native";
import { RootNavigationStack } from "./root-navigation-stack";

const mockSession = {
	user: null as { clerkId: string } | null,
	isSessionLoading: false,
};
const mockListeners = new Set<() => void>();
jest.mock("~/context/AuthContext", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		useAuthSession: () => ({
			isSessionLoading: mockSession.isSessionLoading,
			user: React.useSyncExternalStore(
				(listener) => {
					mockListeners.add(listener);
					return () => {
						mockListeners.delete(listener);
					};
				},
				() => mockSession.user,
			),
		}),
	};
});
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { background: "white" } }),
}));

const fixtures = {
	_layout: RootNavigationStack,
	"(auth)/_layout": () => <Stack />,
	"(auth)/index": () => <Text>Login choice</Text>,
	"(auth)/onboarding": () => <Text>Intro pager</Text>,
	"(app)/_layout": () => <Stack />,
	"(app)/settings": () => <Text>Private settings</Text>,
	subscription: () => null,
	"subscription-success": () => null,
	"learning-times/edit": () => null,
	timetable: () => null,
	"personal-subjects": () => null,
};

describe("auth root history isolation", () => {
	test("retains a cold settings deep link while a persisted session restores", async () => {
		mockSession.user = null;
		mockSession.isSessionLoading = true;
		await renderRouter(fixtures, { initialUrl: "/settings" });
		await act(() => {
			mockSession.isSessionLoading = false;
			mockSession.user = { clerkId: "user_123" };
			for (const listener of mockListeners) listener();
		});
		expect(screen.getByText("Private settings")).toBeTruthy();
	});
	test("signed-out deep links cannot mount settings behind the auth flow", async () => {
		mockSession.user = null;
		await renderRouter(fixtures, { initialUrl: "/settings" });
		expect(
			screen.queryByText("Private settings", { includeHiddenElements: true }),
		).toBeNull();
		expect(screen.getByText("Login choice")).toBeTruthy();
	});
	test("logout removes settings from native history before swiping within auth", async () => {
		mockSession.user = { clerkId: "user_123" };
		await renderRouter(fixtures, { initialUrl: "/settings" });
		expect(screen.getByText("Private settings")).toBeTruthy();
		await act(() => router.push("/"));
		await act(() => {
			mockSession.user = null;
			for (const listener of mockListeners) listener();
		});
		expect(
			screen.queryByText("Private settings", { includeHiddenElements: true }),
		).toBeNull();
		await act(() => router.push("/onboarding"));
		await act(() => router.back());
		expect(screen.getByText("Login choice")).toBeTruthy();
		expect(router.canGoBack()).toBe(false);
	});
	test("authenticated users retain settings and ordinary back navigation", async () => {
		mockSession.user = { clerkId: "user_123" };
		await renderRouter(fixtures, { initialUrl: "/settings" });
		await act(() => router.push("/timetable"));
		await act(() => router.back());
		expect(screen.getByText("Private settings")).toBeTruthy();
	});
	test("the intro can go back to login without exposing a signed-out app route", async () => {
		mockSession.user = null;
		await renderRouter(fixtures, { initialUrl: "/" });
		await act(() => router.push("/onboarding"));
		expect(screen.getByText("Intro pager")).toBeTruthy();
		await act(() => router.back());
		expect(screen.getByText("Login choice")).toBeTruthy();
		expect(
			screen.queryByText("Private settings", { includeHiddenElements: true }),
		).toBeNull();
	});
});
