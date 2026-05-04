import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { Button } from "~/components/ui/button";
import { Text as UiText } from "~/components/ui/text";

export default function WelcomeScreen() {
	const router = useRouter();

	return (
		<View className="flex-1 bg-black">
			<StatusBar style="light" />

			{/* Visual Placeholder (Top) */}
			<View className="flex-1 items-center justify-center">
				<View className="h-64 w-64 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
					<Text className="font-bold font-poppins text-24 text-white/20">
						Visual 17:628
					</Text>
				</View>
			</View>

			{/* Bottom Content Card (17:627) */}
			<View className="rounded-t-card border-white/10 border-t bg-[#16181B] px-10 pt-12 pb-16">
				<Text className="text-center font-poppins font-semibold text-24 text-white leading-tight">
					Entdecke neue Lernwege
				</Text>
				<Text className="mt-4 text-center font-poppins text-16 text-white/60 leading-6">
					Lernen ist für alle da! Melde dich an und erhalte Zugriff auf unsere
					besten Lernmethoden und Kurse.
				</Text>

				{/* Pagination Dots (17:631) */}
				<View className="mt-8 flex-row justify-center space-x-2">
					<View className="h-2 w-4 rounded-full bg-white" />
					<View className="h-2 w-2 rounded-full bg-white/30" />
					<View className="h-2 w-2 rounded-full bg-white/30" />
				</View>

				{/* Action Buttons */}
				<Button onPress={() => router.push("/register")} className="mt-10">
					<UiText>Weiter</UiText>
				</Button>

				<Button
					variant="outline"
					onPress={() => router.push("/register")}
					className="mt-4 bg-transparent"
				>
					<UiText className="text-white">Überspringen</UiText>
				</Button>
			</View>
		</View>
	);
}
