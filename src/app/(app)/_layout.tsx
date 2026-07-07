import { Tabs } from "expo-router";
import { BottomNav } from "~/components/bottom-nav";

export default function AppLayout() {
	return (
		<Tabs
			tabBar={(props) => <BottomNav {...props} />}
			screenOptions={{
				headerShown: false,
			}}
		>
			<Tabs.Screen name="home" options={{ title: "Startseite" }} />
			<Tabs.Screen name="learning-plans" options={{ title: "Lernpläne" }} />
			<Tabs.Screen name="settings" options={{ title: "Einstellungen" }} />
		</Tabs>
	);
}
