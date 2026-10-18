import { useLocalSearchParams, useRouter } from "expo-router";
import LearningTimesOverviewScreen from "~/app/learning-times";
import { dismissToOrReplace } from "~/lib/navigation";
import { getSafeReturnTo, ROUTES, withReturnTo } from "~/lib/routes";

// Preserve existing editor links while presenting the same in-place sheet.
export default function LearningTimeEditorRoute() {
	const router = useRouter();
	const params = useLocalSearchParams<{
		day?: string;
		id?: string;
		returnTo?: string;
	}>();
	const day = Number(params.day);
	const overviewPath = withReturnTo(
		ROUTES.learningTimes,
		getSafeReturnTo(params.returnTo),
	);
	return (
		<LearningTimesOverviewScreen
			initialEditor={{
				day: Number.isInteger(day) && day >= 1 && day <= 7 ? day : 1,
				id: params.id,
			}}
			onEditorClose={() => dismissToOrReplace(router, overviewPath)}
		/>
	);
}
