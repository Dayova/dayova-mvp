import { expect, test } from "vitest";
import {
	contactChoiceError,
	emptyContactChoice,
	normalizeContactPhone,
	prepareContactChoice,
} from "./contact-preferences";

test.each([
	["01512 3456789", "+4915123456789"],
	["0049 1512 3456789", "+4915123456789"],
	["+1 213 373 4253", "+12133734253"],
	["call +49 1512 3456789", null],
	["+49 123", null],
	["+49 30 901820 ext. 2", null],
])("normalizes %s to %s", (input, expected) => {
	expect(normalizeContactPhone(input)).toBe(expected);
});
test("allows skipping independently of number validity", () => {
	expect(
		contactChoiceError({ ...emptyContactChoice(), phone: "123" }),
	).toBeNull();
	expect(
		contactChoiceError({ ...emptyContactChoice(), feedback: true }),
	).toContain("gültige Telefonnummer");
});

test("strips an unused number before durable staging", () => {
	expect(
		prepareContactChoice({
			...emptyContactChoice(),
			phone: "private unused draft",
		}),
	).toEqual(emptyContactChoice());
});

test("projects exactly the write contract from a loaded server snapshot", () => {
	const snapshot = {
		...emptyContactChoice(),
		phone: "+4915123456789",
		news: true,
		revision: 2,
		updatedAt: 42,
	};
	expect(prepareContactChoice(snapshot)).toEqual({
		...emptyContactChoice(),
		phone: "+4915123456789",
		news: true,
	});
});
