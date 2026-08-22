import type React from "react";
import { createContext, useContext, useMemo, useState } from "react";
import type { SupportedSchoolType } from "~/lib/school-types";

export type OnboardingAnswers = {
	studyTime: string;
	studyDays: string;
	learningTime: string;
	state: string;
	schoolType: SupportedSchoolType | "";
	grade: string;
	name: string;
	email: string;
	birthYear: string;
	birthMonth: string;
	birthDay: string;
	password: string;
};

const emptyAnswers: OnboardingAnswers = {
	studyTime: "",
	studyDays: "",
	learningTime: "",
	state: "",
	schoolType: "",
	grade: "",
	name: "",
	email: "",
	birthYear: "",
	birthMonth: "",
	birthDay: "",
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
