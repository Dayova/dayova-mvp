import { StatusBar } from "expo-status-bar";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Route2 } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { ROUTES } from "~/lib/routes";

export default function LearningPlansScreen() {
	const insets = useSafeAreaInsets();

	return (
		<View className="flex-1 bg-[#F6F4F7]">
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					paddingHorizontal: 24,
					paddingTop: Math.max(insets.top + 24, 40),
					paddingBottom: Math.max(insets.bottom + 120, 150),
				}}
				showsVerticalScrollIndicator={false}
			>
				<View className="mb-8">
					<View className="mb-5 h-16 w-16 items-center justify-center rounded-[24px] bg-primary/12">
						<Route2 size={30} color="#3A7BFF" strokeWidth={2.2} />
					</View>
					<Text className="font-bold font-poppins text-34 text-text">
						Lernpläne
					</Text>
					<Text className="mt-3 font-poppins text-15 text-text/56 leading-6">
						Deine eingetragenen Lernslots erscheinen aktuell im Kalender auf der
						Startseite. Neue Lernpläne erstellst du aus einer Leistungskontrolle
						heraus.
					</Text>
				</View>

				<View
					className="rounded-[30px] bg-white px-5 py-6"
					style={{
						borderWidth: 1,
						borderColor: "rgba(17,24,39,0.06)",
						boxShadow: "0 18px 36px rgba(20, 28, 48, 0.10)",
					}}
				>
					<Text className="font-bold font-poppins text-18 text-text">
						So erstellst du einen Lernplan
					</Text>
					<Text className="mt-3 font-poppins text-14 text-text/60 leading-6">
						Lege auf der Startseite eine Leistungskontrolle an und wähle dort
						"Lernplan erstellen". Die eigentliche Erstellung läuft weiterhin
						über die eindeutige Route {ROUTES.createLearningPlan}.
					</Text>
				</View>
			</ScrollView>
		</View>
	);
}
