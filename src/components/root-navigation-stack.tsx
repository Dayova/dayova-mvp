import { Stack } from "expo-router";
import { useAuthSession } from "~/context/AuthContext";
import { useDayovaTheme } from "~/lib/theme";

export function RootNavigationStack() {
	const { colors } = useDayovaTheme();
	const { user, isSessionLoading } = useAuthSession();
	return (
		<Stack
			screenOptions={{
				headerShown: false,
				// Keep ordinary pages on the same native transition per platform.
				animation: "default",
				contentStyle: { backgroundColor: colors.background },
			}}
		>
			{/* Only the inner auth stack owns back gestures. The auth boundary
			    must never reveal a previous app screen during an interactive pop. */}
			<Stack.Screen
				name="(auth)"
				options={{ animation: "none", gestureEnabled: false }}
			/>
			{/* Remove tab history only after confirmed sign-out. During restoration,
			    AuthNavigationGate masks the preserved destination. */}
			<Stack.Protected guard={isSessionLoading || Boolean(user)}>
				<Stack.Screen name="(app)" options={{ animation: "none" }} />
			</Stack.Protected>
			<Stack.Screen
				name="subscription"
				options={{
					gestureEnabled: true,
					presentation: "card",
				}}
			/>
			<Stack.Screen
				name="subscription-success"
				options={{
					animation: "none",
					gestureEnabled: false,
					presentation: "card",
				}}
			/>
			<Stack.Screen
				name="learning-times/edit"
				options={{
					contentStyle: { backgroundColor: colors.background },
					gestureEnabled: true,
					presentation: "card",
				}}
			/>
			<Stack.Screen
				name="timetable"
				options={{
					contentStyle: { backgroundColor: colors.background },
					gestureEnabled: true,
					presentation: "card",
				}}
			/>
			<Stack.Screen
				name="personal-subjects"
				options={{
					contentStyle: { backgroundColor: colors.background },
					gestureEnabled: true,
					presentation: "card",
				}}
			/>
		</Stack>
	);
}
