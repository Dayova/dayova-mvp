import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	analyticsCapture: vi.fn(),
	createValidationAnalytics: vi.fn(),
	logDiagnosticError: vi.fn(),
	markActivity: vi.fn(),
	posthog: { capture: vi.fn(), identify: vi.fn(), reset: vi.fn() },
}));

vi.mock("react", () => ({ useCallback: (callback: unknown) => callback }));
vi.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useMutation: () => mocks.markActivity,
	useQuery: () => ({
		_id: "convex-user-1",
		validationStudentCode: "S1",
	}),
}));
vi.mock("posthog-react-native", () => ({ usePostHog: () => mocks.posthog }));
vi.mock("#convex/_generated/api", () => ({
	api: {
		users: { getMe: "users.getMe" },
		validationAnalytics: { markActivity: "validationAnalytics.markActivity" },
	},
}));
vi.mock("~/context/AuthContext", () => ({
	useAuth: () => ({
		user: { clerkId: "clerk-user-1", validationStudentCode: "S1" },
	}),
}));
vi.mock("~/lib/analytics", () => ({
	createValidationAnalytics: mocks.createValidationAnalytics,
	isPostHogConfigured: true,
}));
vi.mock("~/lib/day-key", () => ({ getDayKey: () => "2026-07-21" }));
vi.mock("~/lib/diagnostics", () => ({
	logDiagnosticError: mocks.logDiagnosticError,
}));

import { useValidationAnalytics } from "./use-validation-analytics";

describe("useValidationAnalytics", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.createValidationAnalytics.mockReturnValue({
			capture: mocks.analyticsCapture,
		});
	});

	it("does not emit analytics when marking backend activity fails", async () => {
		const failure = new Error("backend unavailable");
		mocks.markActivity.mockRejectedValue(failure);
		const { capture } = useValidationAnalytics();

		await capture("onboarding_completed", {
			local_day_key: "2026-07-21",
			onboarding_version: 1,
		});

		expect(mocks.createValidationAnalytics).not.toHaveBeenCalled();
		expect(mocks.analyticsCapture).not.toHaveBeenCalled();
		expect(mocks.logDiagnosticError).toHaveBeenCalledWith(
			"Failed to mark validation activity.",
			failure,
			expect.objectContaining({
				source: "analytics.markActivity",
				metadata: { eventName: "onboarding_completed" },
			}),
		);
	});
});
