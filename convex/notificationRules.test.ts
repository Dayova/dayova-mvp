import { expect, test } from "vitest";
import { learningReminderBody } from "./notificationRules";

test("start reminders have grammatical copy with and without duration", () => {
	expect(learningReminderBody({ title: "Mathe" }, "startEvent")).toBe(
		"Mathe steht jetzt an. Starte deine Lernsession.",
	);
	expect(learningReminderBody({}, "startEvent")).toBe(
		"Deine Lernsession steht jetzt an. Starte deine Lernsession.",
	);
	expect(
		learningReminderBody({ title: "Mathe", durationMinutes: 25 }, "startEvent"),
	).toBe("Mathe: 25 Minuten stehen jetzt an. Starte deine Lernsession.");
});
