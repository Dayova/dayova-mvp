import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { AppState } from "react-native";
import { FeatureAnalyticsProvider } from "./feature-analytics-provider";

let mockChannel: string | null = "";
let mockRuntimeVersion: string | null = "";
const mockPosthog = {
	capture: jest.fn(),
	identify: jest.fn(),
	reset: jest.fn(),
};

jest.mock("posthog-react-native", () => ({ usePostHog: () => mockPosthog }));
jest.mock("expo-router", () => ({
	useSegments: () => ["(app)", "home"],
	usePathname: () => "/home",
}));
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
}));
jest.mock("expo-updates", () => ({
	updateId: null,
	get channel() {
		return mockChannel;
	},
	get runtimeVersion() {
		return mockRuntimeVersion;
	},
	isEmbeddedLaunch: false,
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({
		user: { clerkId: "synthetic-native-context-user" },
		isSessionLoading: false,
	}),
}));
jest.mock("~/lib/runtime-config", () => ({
	env: { EXPO_PUBLIC_POSTHOG_API_KEY: "phc_synthetic_test_key" },
}));
jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));

beforeEach(() => {
	jest.restoreAllMocks();
	jest.clearAllMocks();
	Object.defineProperty(AppState, "currentState", {
		configurable: true,
		value: "active",
	});
	jest
		.spyOn(AppState, "addEventListener")
		.mockReturnValue({ remove: jest.fn() });
});

describe("native startup context through the real analytics contract", () => {
	test.each([
		{ channel: "", runtimeVersion: "", expected: {} },
		{
			channel: "",
			runtimeVersion: "1.0.5",
			expected: { eas_runtime_version: "1.0.5" },
		},
		{
			channel: "preview",
			runtimeVersion: "",
			expected: { eas_channel: "preview" },
		},
		{ channel: null, runtimeVersion: null, expected: {} },
		{
			channel: "production",
			runtimeVersion: "1.0.5",
			expected: { eas_channel: "production", eas_runtime_version: "1.0.5" },
		},
	])("captures the first signed-in screen with $channel / $runtimeVersion", async ({
		channel,
		runtimeVersion,
		expected,
	}) => {
		mockChannel = channel;
		mockRuntimeVersion = runtimeVersion;
		await render(<FeatureAnalyticsProvider>{null}</FeatureAnalyticsProvider>);
		expect(mockPosthog.capture).toHaveBeenCalledTimes(1);
		expect(mockPosthog.capture).toHaveBeenCalledWith("app_screen_viewed", {
			analytics_schema_version: 1,
			eas_is_embedded_launch: false,
			screen: "home",
			...expected,
		});
	});
});
