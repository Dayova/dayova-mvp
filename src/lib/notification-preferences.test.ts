import { describe, expect, test } from "vitest";
import {
	applyNotificationPreferencePatch,
	clearConfirmedNotificationPreferencePatch,
	getNotificationPreferencePatchKeys,
	removeNotificationPreferencePatchKeys,
} from "./notification-preferences";
import type { NotificationPlanningPreferences } from "./notification-planner";

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
