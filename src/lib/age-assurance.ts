export const REGISTRATION_MINIMUM_AGE = 13;

export const BIRTH_DATE_REQUIRED_ERROR = "Bitte wähle dein Geburtsdatum aus.";
export const BIRTH_DATE_INVALID_ERROR =
	"Bitte wähle ein gültiges Geburtsdatum aus.";
export const BIRTH_DATE_UNDER_MINIMUM_ERROR =
	"Du musst mindestens 13 Jahre alt sein, um Dayova zu nutzen.";

export type AgeBand = "under_13" | "13_15" | "16_17" | "adult";

type BirthDateParts = {
	day: number;
	month: number;
	year: number;
};

export type AgeAssuranceResult =
	| { status: "missing" }
	| { status: "invalid" }
	| {
			status: "verified";
			age: number;
			ageBand: AgeBand;
			normalizedBirthDate: string;
	  };

const daysInMonth = (year: number, month: number) => {
	if (month === 2) {
		const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
		return isLeapYear ? 29 : 28;
	}
	return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

const parseBirthDate = (value: string): BirthDateParts | null => {
	const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
	if (!match) return null;

	const day = Number(match[1]);
	const month = Number(match[2]);
	const year = Number(match[3]);
	if (
		year < 1 ||
		month < 1 ||
		month > 12 ||
		day < 1 ||
		day > daysInMonth(year, month)
	) {
		return null;
	}

	return { day, month, year };
};

const compareDateParts = (left: BirthDateParts, right: BirthDateParts) =>
	left.year - right.year || left.month - right.month || left.day - right.day;

const getReferenceDateParts = (referenceDate: Date): BirthDateParts => ({
	day: referenceDate.getDate(),
	month: referenceDate.getMonth() + 1,
	year: referenceDate.getFullYear(),
});

const getAge = (birthDate: BirthDateParts, referenceDate: BirthDateParts) => {
	const birthdayHasPassed =
		referenceDate.month > birthDate.month ||
		(referenceDate.month === birthDate.month &&
			referenceDate.day >= birthDate.day);
	return referenceDate.year - birthDate.year - (birthdayHasPassed ? 0 : 1);
};

const getAgeBand = (age: number): AgeBand => {
	if (age < 13) return "under_13";
	if (age < 16) return "13_15";
	if (age < 18) return "16_17";
	return "adult";
};

const formatBirthDate = ({ day, month, year }: BirthDateParts) =>
	`${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${String(
		year,
	).padStart(4, "0")}`;

export const getAgeAssuranceResult = (
	value: string | undefined,
	referenceDate = new Date(),
): AgeAssuranceResult => {
	if (!value?.trim()) return { status: "missing" };

	const birthDate = parseBirthDate(value);
	const referenceDateParts = getReferenceDateParts(referenceDate);
	if (
		!birthDate ||
		Number.isNaN(referenceDate.getTime()) ||
		compareDateParts(birthDate, referenceDateParts) > 0
	) {
		return { status: "invalid" };
	}

	const age = getAge(birthDate, referenceDateParts);
	return {
		status: "verified",
		age,
		ageBand: getAgeBand(age),
		normalizedBirthDate: formatBirthDate(birthDate),
	};
};

export const getBirthDateError = (
	value: string | undefined,
	referenceDate = new Date(),
) => {
	const result = getAgeAssuranceResult(value, referenceDate);
	if (result.status === "missing") return BIRTH_DATE_REQUIRED_ERROR;
	if (result.status === "invalid") return BIRTH_DATE_INVALID_ERROR;
	if (result.ageBand === "under_13") return BIRTH_DATE_UNDER_MINIMUM_ERROR;
	return null;
};

export const requireEligibleBirthDate = (
	value: string | undefined,
	referenceDate = new Date(),
) => {
	const error = getBirthDateError(value, referenceDate);
	if (error) throw new Error(error);

	const result = getAgeAssuranceResult(value, referenceDate);
	if (result.status !== "verified") throw new Error(BIRTH_DATE_INVALID_ERROR);
	return result.normalizedBirthDate;
};

export const normalizeEligibleBirthDateIfPresent = (
	value: string | undefined,
	referenceDate = new Date(),
) => {
	if (!value?.trim()) return undefined;
	return requireEligibleBirthDate(value, referenceDate);
};

export const getLatestEligibleBirthDate = (referenceDate = new Date()) => {
	const year = referenceDate.getFullYear() - REGISTRATION_MINIMUM_AGE;
	const monthIndex = referenceDate.getMonth();
	const day = Math.min(
		referenceDate.getDate(),
		daysInMonth(year, monthIndex + 1),
	);
	return new Date(year, monthIndex, day);
};
