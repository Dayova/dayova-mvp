import { Slot } from "expo-router";
import { View } from "react-native";
import { BottomNav } from "~/components/bottom-nav";

export default function AppLayout() {
	return (
		<View className="flex-1 bg-[#F6F4F7]">
			<Slot />
			<BottomNav />
		</View>
	);
}
