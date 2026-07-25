import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import { useEffect } from "react";
import type {
	AnalyticsProperties,
	ValidationEventName,
} from "~/lib/analytics-core";
import { useValidationAnalytics } from "./analytics";

const mockMarkActivity = jest.fn<
	(input: { localDayKey: string }) => Promise<{ validationStudentCode: string }>
>(async () => ({ validationStudentCode: "student-42" }));
const mockPostHog = {
	capture: jest.fn(),
	identify: jest.fn(),
};
const mockUseQuery = jest.fn((_query: unknown, _args: unknown) => undefined);

jest.mock("convex/react", () => ({
	useMutation: () => mockMarkActivity,
	useQuery: (query: unknown, args: unknown) => mockUseQuery(query, args),
}));

jest.mock("posthog-react-native", () => ({
	usePostHog: () => mockPostHog,
}));

jest.mock("#convex/_generated/api", () => ({
	api: {
		users: { getMe: "users.getMe" },
		validationAnalytics: { markActivity: "validationAnalytics.markActivity" },
	},
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({
		isConvexAuthenticated: true,
		user: { clerkId: "user_123" },
	}),
}));

jest.mock("~/lib/runtime-config", () => ({
	env: {
		EXPO_PUBLIC_POSTHOG_API_KEY: "phc_test",
		EXPO_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
	},
}));

type Capture = (
	eventName: ValidationEventName,
	properties?: AnalyticsProperties,
) => Promise<void>;

function AnalyticsProbe({ onReady }: { onReady: (capture: Capture) => void }) {
	const { capture } = useValidationAnalytics();

	useEffect(() => onReady(capture), [capture, onReady]);

	return null;
}

describe("useValidationAnalytics", () => {
	beforeEach(() => {
		mockMarkActivity.mockClear();
		mockPostHog.capture.mockClear();
		mockPostHog.identify.mockClear();
		mockUseQuery.mockReset();
		mockUseQuery.mockReturnValue(undefined);
	});

	test("retains authenticated activity while the user profile is still loading", async () => {
		let capture: Capture | undefined;
		await render(
			<AnalyticsProbe
				onReady={(nextCapture) => {
					capture = nextCapture;
				}}
			/>,
		);

		await waitFor(() => expect(capture).toBeDefined());
		await act(async () => {
			await capture?.("dashboard_viewed", { source: "test" });
		});

		expect(mockMarkActivity).toHaveBeenCalledWith({
			localDayKey: expect.any(String),
		});
		expect(mockPostHog.capture).toHaveBeenCalledWith("dashboard_viewed", {
			clerk_id: "user_123",
			source: "test",
			validation_student_code: "student-42",
		});
	});
});
