import { Redirect } from "expo-router";
import { useAuthSession } from "~/context/AuthContext";
import { useOnboarding } from "~/context/OnboardingContext";
import { OnboardingCreationScreen } from "~/features/auth/dayova-auth-flow";

export default function OnboardingCreatingRoute() {
	const { isRegistrationStage } = useOnboarding();
	const { onboardingCompletionStatus } = useAuthSession();
	const isResumingDurableHandoff = onboardingCompletionStatus !== "none";
	if (!isRegistrationStage("creating") && !isResumingDurableHandoff) {
		return <Redirect href="/" />;
	}
	return <OnboardingCreationScreen />;
}
