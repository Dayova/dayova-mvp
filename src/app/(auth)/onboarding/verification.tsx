import { Redirect } from "expo-router";
import { useOnboarding } from "~/context/OnboardingContext";
import { OnboardingVerificationScreen } from "~/features/auth/dayova-auth-flow";

export default function OnboardingVerificationRoute() {
	const { isRegistrationStage } = useOnboarding();
	if (!isRegistrationStage("verification")) return <Redirect href="/" />;
	return <OnboardingVerificationScreen />;
}
