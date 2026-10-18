import { Redirect, useLocalSearchParams } from "expo-router";
import { useOnboarding } from "~/context/OnboardingContext";
import { OnboardingStepScreen } from "~/features/auth/dayova-auth-flow";
import {
	isOnboardingStepId,
	resolveOnboardingStepEntry,
} from "~/features/auth/onboarding-route-model";

export default function OnboardingStepRoute() {
	const params = useLocalSearchParams<{ step?: string | string[] }>();
	const requestedStep = Array.isArray(params.step)
		? params.step[0]
		: params.step;
	const { isStepVisited } = useOnboarding();
	if (!requestedStep || !isOnboardingStepId(requestedStep)) {
		return <Redirect href="/" />;
	}
	const resolution = resolveOnboardingStepEntry({
		requestedStep,
		visitedSteps: new Set(isStepVisited(requestedStep) ? [requestedStep] : []),
	});
	if (resolution.kind === "fallback")
		return <Redirect href={resolution.path} />;
	return <OnboardingStepScreen stepId={resolution.stepId} />;
}
