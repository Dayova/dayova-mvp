import { View } from "react-native";
import { useAuthSession } from "~/context/AuthContext";
import { DashboardScreen } from "~/features/dashboard/dashboard-screen";
import { FirstPlanPrompt } from "~/features/dashboard/first-plan-prompt";

export default function HomeScreen() {
	const { user } = useAuthSession();
	return (
		<View className="flex-1">
			<DashboardScreen />
			<FirstPlanPrompt key={user?.clerkId ?? "signed-out"} />
		</View>
	);
}
