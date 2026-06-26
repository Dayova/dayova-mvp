import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";

export default function AuthChoiceScreen() {
	return (
		<SafeAreaView className="flex-1 bg-background">
			<Stack.Screen options={{ title: "Anmelden / Registrieren" }} />
			<StatusBar style="dark" />

			<ScrollView
				className="flex-1"
				contentContainerClassName="grow px-6 pt-[132px] pb-10"
				contentInsetAdjustmentBehavior="automatic"
				showsVerticalScrollIndicator={false}
			>
				<View className="flex-1 gap-8">
					<View className="gap-16">
						<View className="items-center gap-3">
							<Text className="text-center font-poppins font-semibold text-body-1 text-text">
								Du bist neu hier?
							</Text>
							<Text className="text-center font-poppins text-body-5 text-secondary-text">
								Schön, dich kennenzulernen!
							</Text>
						</View>

						<Button
							accessibilityLabel="Registrieren"
							onPress={() => router.push("/onboarding")}
						>
							<Text>Registrieren</Text>
						</Button>
					</View>

					<View className="my-7 h-px bg-border" />

					<View className="gap-16">
						<View className="items-center gap-4">
							<Text className="max-w-[260px] text-center font-poppins font-semibold text-heading-2 text-text">
								Du hast schon ein{"\n"}Konto?
							</Text>
							<Text className="text-center font-poppins text-body-5 text-secondary-text">
								Melde dich direkt an und mach dort weiter, wo du aufgehört hast.
							</Text>
						</View>

						<Button
							accessibilityLabel="Anmelden"
							onPress={() => router.push("/login")}
							variant="neutral"
						>
							<Text>Anmelden</Text>
						</Button>
					</View>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}
