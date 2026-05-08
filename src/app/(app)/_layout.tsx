import { Tabs } from "expo-router";
import { BottomNav } from "~/components/bottom-nav";

export default function AppLayout() {
	return (
		<Tabs
			tabBar={(props) => <BottomNav {...props} />}
			screenOptions={{
				headerShown: false,
				sceneStyle: { backgroundColor: "#F6F4F7" },
			}}
		>
			<Tabs.Screen name="home" options={{ title: "Startseite" }} />
			<Tabs.Screen name="learning-plans" options={{ title: "Lernpläne" }} />
			<Tabs.Screen name="settings" options={{ title: "Einstellungen" }} />
		</Tabs>
	);
}
