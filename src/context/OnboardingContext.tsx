import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
} from "react";
import type { OnboardingStepId } from "~/features/auth/onboarding-route-model";
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

type OnboardingRegistrationStage = "flow" | "verification" | "creating";

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
	introIndex: number;
	setIntroIndex: (index: number) => void;
	visitedSteps: ReadonlySet<OnboardingStepId>;
	visitStep: (stepId: OnboardingStepId) => void;
	isStepVisited: (stepId: OnboardingStepId) => boolean;
	stepErrors: Readonly<Partial<Record<OnboardingStepId, string>>>;
	setStepError: (stepId: OnboardingStepId, error: string | null) => void;
	registrationStage: OnboardingRegistrationStage;
	setRegistrationStage: (stage: OnboardingRegistrationStage) => void;
	isRegistrationStage: (stage: OnboardingRegistrationStage) => boolean;
	verificationError: string | null;
	setVerificationError: (error: string | null) => void;
	progressOrigin: number | null;
	setProgressOrigin: (progress: number | null) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
	undefined,
);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [answers, setAnswers] = useState<OnboardingAnswers>(emptyAnswers);
	const [introIndex, setIntroIndex] = useState(0);
	const [visitedSteps, setVisitedSteps] = useState<
		ReadonlySet<OnboardingStepId>
	>(() => new Set());
	const visitedStepsRef = useRef<ReadonlySet<OnboardingStepId>>(new Set());
	const [stepErrors, setStepErrors] = useState<
		Partial<Record<OnboardingStepId, string>>
	>({});
	const [registrationStage, setRegistrationStageState] =
		useState<OnboardingRegistrationStage>("flow");
	const registrationStageRef = useRef<OnboardingRegistrationStage>("flow");
	const [verificationError, setVerificationError] = useState<string | null>(
		null,
	);
	const [progressOrigin, setProgressOrigin] = useState<number | null>(null);
	const visitStep = useCallback((stepId: OnboardingStepId) => {
		if (visitedStepsRef.current.has(stepId)) return;
		const next = new Set([...visitedStepsRef.current, stepId]);
		visitedStepsRef.current = next;
		setVisitedSteps(next);
	}, []);
	const isStepVisited = useCallback(
		(stepId: OnboardingStepId) => visitedStepsRef.current.has(stepId),
		[],
	);
	const setRegistrationStage = useCallback(
		(stage: OnboardingRegistrationStage) => {
			registrationStageRef.current = stage;
			setRegistrationStageState(stage);
		},
		[],
	);
	const isRegistrationStage = useCallback(
		(stage: OnboardingRegistrationStage) =>
			registrationStageRef.current === stage,
		[],
	);
	const setStepError = useCallback(
		(stepId: OnboardingStepId, error: string | null) => {
			setStepErrors((current) => {
				if (error) return { ...current, [stepId]: error };
				if (!(stepId in current)) return current;
				const next = { ...current };
				delete next[stepId];
				return next;
			});
		},
		[],
	);

	const value = useMemo<OnboardingContextValue>(
		() => ({
			answers,
			setAnswer: (field, value) => {
				setAnswers((current) => ({ ...current, [field]: value }));
				setStepErrors((current) => {
					const stepId = field as OnboardingStepId;
					if (!(stepId in current)) return current;
					const next = { ...current };
					delete next[stepId];
					return next;
				});
			},
			clearAnswers: () => {
				setAnswers(emptyAnswers);
				setIntroIndex(0);
				visitedStepsRef.current = new Set();
				setVisitedSteps(new Set());
				setStepErrors({});
				setRegistrationStage("flow");
				setVerificationError(null);
				setProgressOrigin(null);
			},
			hasAnswers: Object.values(answers).some(
				(value) => value.trim().length > 0,
			),
			introIndex,
			setIntroIndex,
			visitedSteps,
			visitStep,
			isStepVisited,
			stepErrors,
			setStepError,
			registrationStage,
			setRegistrationStage,
			isRegistrationStage,
			verificationError,
			setVerificationError,
			progressOrigin,
			setProgressOrigin,
		}),
		[
			answers,
			introIndex,
			progressOrigin,
			registrationStage,
			isRegistrationStage,
			isStepVisited,
			setStepError,
			setRegistrationStage,
			stepErrors,
			verificationError,
			visitStep,
			visitedSteps,
		],
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
