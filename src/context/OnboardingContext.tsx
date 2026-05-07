import type React from "react";
import { createContext, useContext, useMemo, useState } from "react";

export type OnboardingAnswers = {
	studyTime: string;
	strength: string;
	challenge: string;
	goal: string;
	state: string;
};

const emptyAnswers: OnboardingAnswers = {
	studyTime: "",
	strength: "",
	challenge: "",
	goal: "",
	state: "",
};

type OnboardingContextValue = {
	answers: OnboardingAnswers;
	setAnswer: (field: keyof OnboardingAnswers, value: string) => void;
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
