import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
	type TrackFeatureInteraction,
	useFeatureAnalytics,
} from "~/lib/use-feature-analytics";
import { FeatureAnalyticsProvider } from "./feature-analytics-provider";

let mockIdentity: string | undefined = "user-a";
let mockAuthenticated = true;
let mockLoading = false;
let mockSegments = ["(app)", "home"];
let mockConfigured = true;
let mockPathname: string | undefined;
let mockEasChannel: string | null = "preview";
const mockCapture = jest.fn();
const mockClient = {};
let track: TrackFeatureInteraction;
let listener: (state: AppStateStatus) => void;
jest.mock("posthog-react-native", () => ({ usePostHog: () => mockClient }));
jest.mock("expo-router", () => ({
	useSegments: () => mockSegments,
	usePathname: () => mockPathname ?? mockSegments.join("/"),
}));
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: mockAuthenticated }),
}));
jest.mock("expo-updates", () => ({
	updateId: "update-1",
	get channel() {
		return mockEasChannel;
	},
	runtimeVersion: "1",
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({
		user: mockIdentity ? { clerkId: mockIdentity } : null,
		isSessionLoading: mockLoading,
	}),
}));
jest.mock("~/lib/analytics", () => ({
	get isPostHogConfigured() {
		return mockConfigured;
	},
	createValidationAnalytics: (
		_client: unknown,
		options: {
			configured: boolean;
			distinctId?: string;
			sharedContext?: { easChannel?: string | null };
		},
	) => ({
		capture: (name: string, properties: unknown) => {
			if (options.sharedContext?.easChannel === "") {
				throw new Error("Invalid analytics property: eas_channel");
			}
			if (options.configured && options.distinctId)
				mockCapture(name, properties, options.distinctId);
		},
	}),
}));
function Consumer() {
	const nextTrack = useFeatureAnalytics();
	useEffect(() => {
		track = nextTrack;
	}, [nextTrack]);
	return null;
}
const tree = () => (
	<FeatureAnalyticsProvider>
		<Consumer />
	</FeatureAnalyticsProvider>
);
beforeEach(() => {
	jest.restoreAllMocks();
	mockCapture.mockClear();
	mockIdentity = "user-a";
	mockAuthenticated = true;
	mockLoading = false;
	mockConfigured = true;
	mockPathname = undefined;
	mockEasChannel = "preview";
	mockSegments = ["(app)", "home"];
	Object.defineProperty(AppState, "currentState", {
		configurable: true,
		value: "active",
	});
	jest
		.spyOn(AppState, "addEventListener")
		.mockImplementation((_name, handler) => {
			listener = handler;
			return { remove: jest.fn() };
		});
});
describe("feature analytics observation lifecycle", () => {
	test("does not let an unavailable local EAS channel prevent rendering", () => {
		mockEasChannel = "";
		expect(() => render(tree())).not.toThrow();
	});

	test("counts navigation and foreground exposure, not rerenders or repeated active callbacks", async () => {
		const view = await render(tree());
		await view.rerender(tree());
		await act(() => listener("active"));
		expect(mockCapture).toHaveBeenCalledTimes(1);
		mockSegments = ["(app)", "settings"];
		await view.rerender(tree());
		expect(mockCapture).toHaveBeenLastCalledWith(
			"app_screen_viewed",
			{ screen: "settings" },
			"user-a",
		);
		await act(() => {
			listener("background");
			listener("active");
			listener("active");
		});
		expect(mockCapture).toHaveBeenCalledTimes(3);
	});
	test("observes different route instances without sending their identifiers", async () => {
		mockSegments = ["learning-plans", "[planId]", "sessions", "[sessionId]"];
		mockPathname = "/learning-plans/secret-plan/sessions/secret-session-a";
		const view = await render(tree());
		mockPathname = "/learning-plans/secret-plan/sessions/secret-session-b";
		await view.rerender(tree());
		expect(mockCapture).toHaveBeenCalledTimes(2);
		for (const args of mockCapture.mock.calls)
			expect(args).toEqual([
				"app_screen_viewed",
				{ screen: "learning_session" },
				"user-a",
			]);
	});

	test("uses route templates and never emits unknown routes or route IDs", async () => {
		mockSegments = ["learning-plans", "[planId]", "sessions", "[sessionId]"];
		const view = await render(tree());
		expect(mockCapture).toHaveBeenCalledWith(
			"app_screen_viewed",
			{ screen: "learning_session" },
			"user-a",
		);
		mockSegments = ["private-path", "learner-content"];
		await view.rerender(tree());
		expect(mockCapture).toHaveBeenCalledTimes(1);
	});
	test("suppresses loading, unauthenticated, signed-out, and disabled-platform traffic", async () => {
		mockLoading = true;
		const view = await render(tree());
		track("home.create_opened");
		mockLoading = false;
		mockAuthenticated = false;
		await view.rerender(tree());
		track("home.create_opened");
		mockAuthenticated = true;
		mockIdentity = undefined;
		await view.rerender(tree());
		track("home.create_opened");
		mockIdentity = "user-a";
		mockConfigured = false;
		await view.rerender(tree());
		track("home.create_opened");
		expect(mockCapture).not.toHaveBeenCalled();
	});
	test("discards stale async completions after switching accounts and attributes new actions correctly", async () => {
		const view = await render(tree());
		const stale = track;
		mockIdentity = "user-b";
		await view.rerender(tree());
		mockCapture.mockClear();
		stale("homework.create", "succeeded", "entry-a");
		expect(mockCapture).not.toHaveBeenCalled();
		track("subscription.plan_selected", "performed", undefined, "monthly");
		expect(mockCapture).toHaveBeenCalledWith(
			"feature_interaction",
			{
				interaction: "subscription.plan_selected",
				outcome: "performed",
				value: "monthly",
				screen: "home",
			},
			"user-b",
		);
	});
});
