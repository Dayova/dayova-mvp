import { describe, expect, it, vi } from "vitest";
import {
	createValidationAnalytics,
	validationAnalyticsBeforeSend,
} from "./analytics";
import { analyticsScreenForSegments } from "./feature-analytics";

describe("feature measurement boundary", () => {
	it("only resolves known route templates", () => {
		expect(analyticsScreenForSegments(["(creation)", "entry", "new"])).toBe(
			"entry_creation",
		);
		expect(
			analyticsScreenForSegments(["entry", "private-entry-id"]),
		).toBeUndefined();
		expect(analyticsScreenForSegments(["unknown-screen"])).toBeUndefined();
	});
	it("drops invented interaction names and strips user content before sending", () => {
		const result = validationAnalyticsBeforeSend({
			event: "feature_interaction",
			properties: {
				analytics_schema_version: 1,
				interaction: "homework.create",
				outcome: "succeeded",
				entity_id: "opaque-id",
				notes: "private",
				answer_text: "private",
				screen: "entry_creation",
			},
		});
		expect(result?.properties).toEqual({
			interaction: "homework.create",
			outcome: "succeeded",
			entity_id: "opaque-id",
			screen: "entry_creation",
			analytics_schema_version: 1,
		});
		expect(
			validationAnalyticsBeforeSend({
				event: "feature_interaction",
				properties: {
					interaction: "private learner text",
					outcome: "performed",
				},
			}),
		).toBeNull();
	});
	it("rejects arbitrary action values and real pathnames", () => {
		const adapter = { capture: vi.fn(), identify: vi.fn(), reset: vi.fn() };
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			distinctId: "user",
			mode: "development",
		});
		expect(() =>
			analytics.capture("feature_interaction", {
				interaction: "homework.create",
				outcome: "succeeded",
				value: "secret" as never,
			}),
		).toThrow();
		expect(() =>
			analytics.capture("app_screen_viewed", {
				screen: "/entry/secret" as never,
			}),
		).toThrow();
		expect(adapter.capture).not.toHaveBeenCalled();
	});
	it("never breaks a product action when the optional analytics adapter fails", () => {
		const reportDiagnostic = vi.fn();
		const adapter = {
			capture: vi.fn(() => {
				throw new Error("private transport failure");
			}),
			identify: vi.fn(),
			reset: vi.fn(),
		};
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			distinctId: "user",
			reportDiagnostic,
		});
		expect(() =>
			analytics.capture("feature_interaction", {
				interaction: "homework.create",
				outcome: "succeeded",
			}),
		).not.toThrow();
		expect(reportDiagnostic).toHaveBeenCalledWith({
			eventName: "feature_interaction",
		});
	});
});
