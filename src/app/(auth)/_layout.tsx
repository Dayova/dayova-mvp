import { Redirect, Stack } from "expo-router";
import { View } from "react-native";
import { useAuthSession } from "~/context/AuthContext";

export default function AuthLayout() {
	const { user, isSessionLoading } = useAuthSession();

	// TODO: Give this a real spinner or splash screen or nice animated logo
	if (isSessionLoading) {
		return <View className="flex-1 bg-black" />;
	}

	if (user) {
		return <Redirect href="/home" />;
	}

	return (
		<Stack
			screenOptions={{
				headerShown: false,
				keyboardHandlingEnabled: false,
			}}
		>
			<Stack.Screen
				name="onboarding"
				options={{
					title: "Registrierung",
					gestureEnabled: true,
					fullScreenGestureEnabled: false,
				}}
			/>
		</Stack>
	);
}
