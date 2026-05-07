import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";

export default function AuthChoiceScreen() {
	return (
		<SafeAreaView className="flex-1 bg-[#F7F6F8]">
			<Stack.Screen options={{ title: "MVP Login / Registrierung" }} />
			<StatusBar style="dark" />

			<ScrollView
				className="flex-1"
				contentContainerClassName="grow px-[22px] pt-[132px] pb-[38px]"
				contentInsetAdjustmentBehavior="automatic"
				showsVerticalScrollIndicator={false}
			>
				<View className="flex-1 gap-32">
					<View className="gap-64">
						<View className="items-center gap-[11px]">
							<Text className="text-center font-bold font-poppins text-[#0B0B0F] text-[21px] leading-[26px]">
								Du bist neu hier?
							</Text>
							<Text className="text-center font-poppins text-[#A09EA5] text-[11px] leading-4">
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

					<View className="my-7 h-px bg-[#E5E7EF]" />

					<View className="gap-64">
						<View className="items-center gap-[14px]">
							<Text className="max-w-[260px] text-center font-bold font-poppins text-[#0B0B0F] text-[22px] leading-[27px]">
								Du hast schon einen{"\n"}Account?
							</Text>
							<Text className="text-center font-poppins text-[#8C8A91] text-[11px] leading-4">
								Melde dich direkt an und mach dort weiter, wo du aufgehört hast.
							</Text>
						</View>

						<Button
							accessibilityLabel="Login"
							onPress={() => router.push("/login")}
							variant="neutral"
						>
							<Text>Login</Text>
						</Button>
					</View>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}
