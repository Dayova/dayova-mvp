import { expect, test } from "vitest";
import { getDeliveredNotificationInput } from "./delivered-notification";

const notification = {
	date: new Date("2026-06-09T18:06:21.750Z").getTime(),
	request: {
		content: {
			title: "Hausaufgabe nicht vergessen",
			body: "Du kannst deine Deutsch Hausaufgabe noch als erledigt markieren.",
			data: {
				dayovaNotificationKey: "forgotten:entry-1",
				dayovaOwnerId: "user-1",
				dayovaNotificationRegistrationId: "registration-1",
			},
		},
	},
};

test("extracts a delivered Dayova notification", () => {
	expect(getDeliveredNotificationInput(notification, "user-1")).toEqual({
		registrationId: "registration-1",
		triggeredAt: "2026-06-09T18:06:21.750Z",
	});
});

test("ignores notifications scheduled for another account", () => {
	expect(getDeliveredNotificationInput(notification, "user-2")).toBeNull();
});

test("ignores notification payloads that are not owned by Dayova", () => {
	expect(
		getDeliveredNotificationInput({
			...notification,
			request: {
				content: {
					...notification.request.content,
					data: { dayovaNotificationRegistrationId: "registration-1" },
				},
			},
		}),
	).toBeNull();
});

test("ignores legacy notifications without a server registration", () => {
	expect(
		getDeliveredNotificationInput({
			...notification,
			request: {
				content: {
					...notification.request.content,
					data: {
						dayovaNotificationKey: "forgotten:entry-1",
						dayovaOwnerId: "user-1",
					},
				},
			},
		}),
	).toBeNull();
});
