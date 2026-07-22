import type React from "react";
import { createContext, useContext, useMemo, useState } from "react";
import type { SupportedSchoolType } from "~/lib/school-types";

type OnboardingAnswers = {
	studyTime: string;
	strength: string;
	challenge: string;
	goal: string;
	state: string;
	schoolType: SupportedSchoolType | "";
	grade: string;
	dailySchoolTime: string;
	studyDays: string;
	learningTime: string;
	name: string;
	email: string;
	birthDate: string;
	password: string;
};

const emptyAnswers: OnboardingAnswers = {
	studyTime: "",
	strength: "",
	challenge: "",
	goal: "",
	state: "",
	schoolType: "",
	grade: "",
	dailySchoolTime: "",
	studyDays: "",
	learningTime: "",
	name: "",
	email: "",
	birthDate: "",
	password: "",
};

type OnboardingContextValue = {
	answers: OnboardingAnswers;
	setAnswer: <Field extends keyof OnboardingAnswers>(
		field: Field,
		value: OnboardingAnswers[Field],
	) => void;
	clearAnswers: () => void;
	hasAnswers: boolean;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
	undefined,
);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [answers, setAnswers] = useState<OnboardingAnswers>(emptyAnswers);

	const value = useMemo<OnboardingContextValue>(
		() => ({
			answers,
			setAnswer: (field, value) => {
				setAnswers((current) => ({ ...current, [field]: value }));
			},
			clearAnswers: () => setAnswers(emptyAnswers),
			hasAnswers: Object.values(answers).some(
				(value) => value.trim().length > 0,
			),
		}),
		[answers],
	);

	return (
		<OnboardingContext.Provider value={value}>
			{children}
		</OnboardingContext.Provider>
	);
};

export const useOnboarding = () => {
	const context = useContext(OnboardingContext);
	if (!context) {
		throw new Error("useOnboarding must be used within an OnboardingProvider.");
	}
	return context;
};
