import { describe, expect, test } from "vitest";
import type { NotificationPlanningPreferences } from "./notification-planner";
import {
	applyNotificationPreferencePatch,
	clearConfirmedNotificationPreferencePatch,
	getNotificationPreferenceControlState,
	getNotificationPreferencePatchKeys,
	removeNotificationPreferencePatchKeys,
} from "./notification-preferences";

const preferences: NotificationPlanningPreferences = {
	systemNotificationsEnabled: true,
	dailyBriefingEnabled: true,
	dailyBriefingTime: "07:30",
	beforeExamEnabled: true,
	beforeLearningTimeEnabled: true,
	beforeHomeworkWorkEnabled: true,
	beforeHomeworkDueEnabled: true,
	reminderOffsetMinutes: 15,
	forgottenEventEnabled: true,
};

describe("notification preference pending state", () => {
	test("system delivery does not disable always-on in-app preferences", () => {
		expect(
			getNotificationPreferenceControlState({
				preferences: {
					...preferences,
					systemNotificationsEnabled: false,
				},
				pendingKeys: [],
			}),
		).toEqual({
			systemNotificationsDisabled: false,
			dailyBriefingDisabled: false,
			dailyBriefingTimeDisabled: false,
			beforeExamDisabled: false,
			beforeLearningTimeDisabled: false,
			beforeHomeworkWorkDisabled: false,
			beforeHomeworkDueDisabled: false,
			reminderOffsetDisabled: false,
			forgottenEventDisabled: false,
		});
	});

	test("a pending switch patch only affects its own preference key", () => {
		const patch = { beforeExamEnabled: false };

		expect(getNotificationPreferencePatchKeys(patch)).toEqual([
			"beforeExamEnabled",
		]);
		expect(applyNotificationPreferencePatch(preferences, patch)).toEqual({
			...preferences,
			beforeExamEnabled: false,
		});
	});

	test("confirmed and failed pending patches can be cleared by key", () => {
		const patch: Partial<NotificationPlanningPreferences> = {
			beforeExamEnabled: false,
			forgottenEventEnabled: false,
		};

		expect(
			clearConfirmedNotificationPreferencePatch(patch, {
				...preferences,
				beforeExamEnabled: false,
			}),
		).toEqual({ forgottenEventEnabled: false });
		expect(
			removeNotificationPreferencePatchKeys(patch, ["forgottenEventEnabled"]),
		).toEqual({ beforeExamEnabled: false });
	});
});
