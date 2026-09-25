import { splitClerkName } from "../src/lib/clerk-registration";
import {
	type GermanFederalState,
	isGermanFederalState,
} from "../src/lib/federal-states";
import { isSupportedGrade } from "../src/lib/grades";
import {
	normalizeLegacySchoolType,
	SCHOOL_TYPE_OPTIONS,
} from "../src/lib/school-types";
import type { CrmProjection } from "./crmContract";

const stateCodes: Record<GermanFederalState, string> = {
	"Baden-Württemberg": "BW",
	Bayern: "BY",
	Berlin: "BE",
	Brandenburg: "BB",
	Bremen: "HB",
	Hamburg: "HH",
	Hessen: "HE",
	"Mecklenburg-Vorpommern": "MV",
	Niedersachsen: "NI",
	"Nordrhein-Westfalen": "NW",
	"Rheinland-Pfalz": "RP",
	Saarland: "SL",
	Sachsen: "SN",
	"Sachsen-Anhalt": "ST",
	"Schleswig-Holstein": "SH",
	Thüringen: "TH",
};

export const CRM_PROFILE_PROPERTIES = {
	Student: "title",
	"First Name": "rich_text",
	"Last Name": "rich_text",
	Grade: "select",
	State: "select",
	"School Type": "select",
	OS: "multi_select",
} as const;

const text = (value?: string) => ({
	rich_text: value ? [{ text: { content: value.slice(0, 2000) } }] : [],
});

export function profileProperties(profile: CrmProjection["profile"]) {
	const properties: Record<string, unknown> = {};
	if (profile.operatingSystems?.length) {
		properties.OS = {
			multi_select: profile.operatingSystems.map((name) => ({ name })),
		};
	}
	// Absent source values must not erase manually maintained legacy profiles.
	if (profile.name !== undefined) {
		const name = profile.name.trim();
		const { firstName, lastName } = splitClerkName(name);
		properties.Student = {
			title: [{ text: { content: (name || "Dayova student").slice(0, 2000) } }],
		};
		properties["First Name"] = text(firstName);
		properties["Last Name"] = text(lastName);
	}
	const grade = profile.grade?.trim();
	if (isSupportedGrade(grade)) properties.Grade = { select: { name: grade } };
	const state = profile.state?.trim();
	if (isGermanFederalState(state))
		properties.State = { select: { name: stateCodes[state] } };
	const schoolType = normalizeLegacySchoolType(profile.schoolType);
	if (schoolType) {
		const label = SCHOOL_TYPE_OPTIONS.find(
			(option) => option.value === schoolType,
		)?.label;
		properties["School Type"] = {
			select: schoolType === "prefer_not_to_say" ? null : { name: label },
		};
	}
	return properties;
}
