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
import {
	LEARNING_PLAN_CREATION_STEPS,
	LEARNING_PLAN_CREATION_TOTAL_STEPS,
} from "~/features/learning-plans/creation-progress";
import { LearningPlanCreationProgressHeader } from "~/features/learning-plans/creation-progress-header";

type CreationProgressConfiguration = {
	active: boolean;
	currentStep: number;
	onBack: () => void;
	onClose: () => void;
	closeDisabled?: boolean;
	totalSteps?: number;
};

type CreationProgressPresentation = {
	active: boolean;
	currentStep: number;
	totalSteps: number;
	closeDisabled: boolean;
};

type CreationProgressContextValue = {
	configure: (configuration: CreationProgressConfiguration) => void;
};

const DEFAULT_PRESENTATION: CreationProgressPresentation = {
	active: false,
	currentStep: LEARNING_PLAN_CREATION_STEPS.examDate,
	totalSteps: LEARNING_PLAN_CREATION_TOTAL_STEPS,
	closeDisabled: false,
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
	const onCloseRef = useRef<() => void>(() => undefined);
	const [presentation, setPresentation] =
		useState<CreationProgressPresentation>(DEFAULT_PRESENTATION);

	const configure = useCallback(
		({
			active,
			currentStep,
			onBack,
			onClose,
			closeDisabled = false,
			totalSteps,
		}: CreationProgressConfiguration) => {
			onBackRef.current = onBack;
			onCloseRef.current = onClose;
			const nextTotalSteps = totalSteps ?? LEARNING_PLAN_CREATION_TOTAL_STEPS;
			setPresentation((current) =>
				current.active === active &&
				current.currentStep === currentStep &&
				current.totalSteps === nextTotalSteps &&
				current.closeDisabled === closeDisabled
					? current
					: {
							active,
							currentStep,
							totalSteps: nextTotalSteps,
							closeDisabled,
						},
			);
		},
		[],
	);
	const handleBack = useCallback(() => onBackRef.current(), []);
	const handleClose = useCallback(() => onCloseRef.current(), []);
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
						totalSteps={presentation.totalSteps}
						onClose={handleClose}
						closeDisabled={presentation.closeDisabled}
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
	totalSteps,
	onClose,
	closeDisabled,
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
		context.configure({
			active,
			currentStep,
			onBack,
			onClose,
			closeDisabled,
			totalSteps,
		});
	}, [
		active,
		context,
		currentStep,
		isFocused,
		onBack,
		onClose,
		closeDisabled,
		totalSteps,
	]);
}
