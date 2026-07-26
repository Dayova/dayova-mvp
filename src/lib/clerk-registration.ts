import { isGermanFederalState } from "./federal-states";
import { isSupportedGrade } from "./grades";

export type ClerkRegistrationInput = {
	email: string;
	password: string;
	name?: string;
	phone?: string;
	birthDate?: string;
	grade?: string;
	schoolType?: string;
	state?: string;
};

export type ClerkProfile = {
	name?: string;
	phone?: string;
	birthDate?: string;
	grade?: string;
	schoolType?: string;
	state?: string;
};

export const getDefinedProfileFields = (profile: ClerkProfile) => ({
	...(profile.name !== undefined ? { name: profile.name } : {}),
	...(profile.phone !== undefined ? { phone: profile.phone } : {}),
	...(profile.birthDate !== undefined ? { birthDate: profile.birthDate } : {}),
	...(profile.grade !== undefined ? { grade: profile.grade } : {}),
	...(profile.schoolType !== undefined
		? { schoolType: profile.schoolType }
		: {}),
	...(profile.state !== undefined ? { state: profile.state } : {}),
});

export const splitClerkName = (name?: string) => {
	const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
	const [firstName, ...rest] = parts;
	return {
		firstName,
		lastName: rest.length > 0 ? rest.join(" ") : undefined,
	};
};

export const prepareClerkRegistration = (input: ClerkRegistrationInput) => {
	const grade = input.grade?.trim();
	if (grade && !isSupportedGrade(grade)) {
		throw new Error("Bitte wähle eine gültige Klassenstufe aus.");
	}
	const state = input.state?.trim();
	if (state && !isGermanFederalState(state)) {
		throw new Error("Bitte wähle ein gültiges Bundesland aus.");
	}

	const profile = {
		name: input.name?.trim(),
		phone: input.phone?.trim(),
		birthDate: input.birthDate,
		grade,
		schoolType: input.schoolType?.trim(),
		state,
	};
	const { firstName, lastName } = splitClerkName(profile.name);

	return {
		profile,
		signUp: {
			emailAddress: input.email.trim().toLowerCase(),
			password: input.password,
			firstName,
			lastName,
			unsafeMetadata: getDefinedProfileFields(profile),
		},
	};
};
