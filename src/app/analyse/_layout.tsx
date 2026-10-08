import { Redirect } from "expo-router";
import { ROUTES } from "~/lib/routes";

// DAY-436: keep old links safe while this feature is outside the current app.
export default function DeferredFeatureLayout() {
	return <Redirect href={ROUTES.learningPlans} />;
}
