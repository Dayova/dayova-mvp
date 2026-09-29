import { Stack } from "expo-router";
import { View } from "react-native";
import { useAuthSession } from "~/context/AuthContext";

export default function AuthLayout() {
	const { isSessionLoading } = useAuthSession();

	// TODO: Give this a real spinner or splash screen or nice animated logo
	if (isSessionLoading) {
		return <View className="flex-1 bg-black" />;
	}

	return (
		<Stack
			screenOptions={{
				headerShown: false,
				keyboardHandlingEnabled: false,
				fullScreenGestureEnabled: false,
			}}
		>
			<Stack.Screen
				name="onboarding/index"
				options={{
					title: "Registrierung",
					gestureEnabled: true,
				}}
			/>
			<Stack.Screen
				name="onboarding/[step]"
				options={{
					animation: "none",
					title: "Registrierung",
					gestureEnabled: true,
				}}
			/>
			<Stack.Screen
				name="onboarding/verification"
				options={{ title: "E-Mail bestätigen", gestureEnabled: true }}
			/>
			<Stack.Screen
				name="onboarding/creating"
				options={{ title: "Konto einrichten", gestureEnabled: false }}
			/>
		</Stack>
	);
}
