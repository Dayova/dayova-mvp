import { Redirect, Stack } from "expo-router";
import { View } from "react-native";
import { useAuth } from "~/context/AuthContext";

export default function AuthLayout() {
	const { user, isSessionLoading } = useAuth();

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
    />
  );
}
