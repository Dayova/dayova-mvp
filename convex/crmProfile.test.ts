import { expect, test } from "vitest";
import { GERMAN_FEDERAL_STATES } from "../src/lib/federal-states";
import { profileProperties } from "./crmProfile";

test("profile mapping uses the Clerk name convention and Notion's existing state codes", () => {
	expect(
		profileProperties({
			name: "  Anna   von Beispiel  ",
			grade: "11",
			state: "Nordrhein-Westfalen",
			schoolType: "comprehensive",
		}),
	).toEqual({
		Student: { title: [{ text: { content: "Anna   von Beispiel" } }] },
		"First Name": { rich_text: [{ text: { content: "Anna" } }] },
		"Last Name": { rich_text: [{ text: { content: "von Beispiel" } }] },
		Grade: { select: { name: "11" } },
		State: { select: { name: "NW" } },
		"School Type": { select: { name: "Gesamt- / Gemeinschaftsschule" } },
	});
	expect(
		GERMAN_FEDERAL_STATES.map((state) => profileProperties({ state }).State),
	).toEqual(
		[
			"HB",
			"HH",
			"BW",
			"SN",
			"ST",
			"BB",
			"BY",
			"BE",
			"HE",
			"NI",
			"NW",
			"RP",
			"SL",
			"SH",
			"TH",
			"MV",
		].map((name) => ({ select: { name } })),
	);
});

test("missing and unsupported profile values preserve CRM fields without leaking legacy school names", () => {
	expect(profileProperties({})).toEqual({});
	expect(profileProperties({ operatingSystems: [] })).toEqual({});
	expect(
		profileProperties({
			grade: "university",
			state: "unknown",
			schoolType: "Private school at a specific address",
		}),
	).toEqual({});
	expect(profileProperties({ schoolType: "Realschule" })).toEqual({
		"School Type": {
			select: { name: "Oberschule / Realschule / Sekundarschule" },
		},
	});
});

test("single names and explicit opt-outs clear stale profile values", () => {
	expect(
		profileProperties({ name: "Alex", schoolType: "prefer_not_to_say" }),
	).toMatchObject({
		"First Name": { rich_text: [{ text: { content: "Alex" } }] },
		"Last Name": { rich_text: [] },
		"School Type": { select: null },
	});
	expect(profileProperties({ name: " " })).toMatchObject({
		Student: { title: [{ text: { content: "Dayova student" } }] },
		"First Name": { rich_text: [] },
		"Last Name": { rich_text: [] },
	});
});
