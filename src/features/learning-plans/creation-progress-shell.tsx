import { useIsFocused } from "expo-router";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { LEARNING_PLAN_CREATION_STEPS } from "~/features/learning-plans/creation-progress";
import { LearningPlanCreationProgressHeader } from "~/features/learning-plans/creation-progress-header";

type CreationProgressConfiguration = {
	active: boolean;
	currentStep: number;
	onBack: () => void;
	title?: string;
};

type CreationProgressPresentation = Pick<
	CreationProgressConfiguration,
	"active" | "currentStep"
> & {
	title: string;
};

type CreationProgressContextValue = {
	configure: (configuration: CreationProgressConfiguration) => void;
};

const DEFAULT_PRESENTATION: CreationProgressPresentation = {
	active: false,
	currentStep: LEARNING_PLAN_CREATION_STEPS.examDate,
	title: "Prüfung eintragen",
};

const CreationProgressContext =
	createContext<CreationProgressContextValue | null>(null);

export function LearningPlanCreationProgressShell({
	children,
}: {
	children: ReactNode;
}) {
	const insets = useSafeAreaInsets();
	const onBackRef = useRef<() => void>(() => undefined);
	const [presentation, setPresentation] =
		useState<CreationProgressPresentation>(DEFAULT_PRESENTATION);

	const configure = useCallback(
		({ active, currentStep, onBack, title }: CreationProgressConfiguration) => {
			onBackRef.current = onBack;
			const nextTitle = title ?? "Lernplan erstellen";
			setPresentation((current) =>
				current.active === active &&
				current.currentStep === currentStep &&
				current.title === nextTitle
					? current
					: { active, currentStep, title: nextTitle },
			);
		},
		[],
	);
	const handleBack = useCallback(() => onBackRef.current(), []);
	const contextValue = useMemo(() => ({ configure }), [configure]);

	return (
		<CreationProgressContext.Provider value={contextValue}>
			<View className="flex-1 bg-background">
				<ThemedStatusBar />
				<View
					pointerEvents={presentation.active ? "auto" : "none"}
					className="bg-background px-8 pb-8"
					// The shell owns the device safe area and remains mounted while the
					// nested creation routes change underneath it.
					style={{
						display: presentation.active ? "flex" : "none",
						paddingTop: Math.max(insets.top + 20, 52),
					}}
				>
					<LearningPlanCreationProgressHeader
						currentStep={presentation.currentStep}
						onBack={handleBack}
						title={presentation.title}
					/>
				</View>
				<View className="flex-1">{children}</View>
			</View>
		</CreationProgressContext.Provider>
	);
}

export function useLearningPlanCreationProgress({
	active,
	currentStep,
	onBack,
	title,
}: CreationProgressConfiguration) {
	const context = useContext(CreationProgressContext);
	const isFocused = useIsFocused();
	if (!context) {
		throw new Error(
			"useLearningPlanCreationProgress must be used inside LearningPlanCreationProgressShell",
		);
	}

	useLayoutEffect(() => {
		if (!isFocused) return;
		context.configure({ active, currentStep, onBack, title });
	}, [active, context, currentStep, isFocused, onBack, title]);
}
