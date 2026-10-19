import { Redirect, useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "~/components/ui/button";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { isHintValidationAvailable } from "~/features/learning-plans/hint-validation-preference";
import { ROUTES } from "~/lib/routes";

/** Internal entry to the current flow; no synthetic data or authentication bypass. */
export default function HintValidationScreen() {
	const router = useRouter();
	if (!isHintValidationAvailable) return <Redirect href="/home" />;
	return (
		<Screen>
			<ScreenScroll>
				<View className="gap-5">
					<Text
						accessibilityRole="header"
						className="font-poppins font-semibold text-body-1 text-text"
					>
						Themen und Hinweise testen
					</Text>
					<Text className="font-poppins text-body-3 text-secondary-text">
						Zuerst Themen auswählen, danach optionale Hinweise ergänzen. Beide
						haben eine eigene Suchseite. Frühere Testeinstellungen ändern diesen
						Ablauf nicht.
					</Text>
					<Button onPress={() => router.replace(ROUTES.createExam)}>
						<Text>Neue Prüfung</Text>
					</Button>
					<Button
						variant="cancel"
						onPress={() => router.replace(ROUTES.learningPlans)}
					>
						<Text>Entwurf öffnen</Text>
					</Button>
				</View>
			</ScreenScroll>
		</Screen>
	);
}
