import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "~/components/ui/button";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import {
	type HintVariant,
	isHintValidationAvailable,
	writeHintVariant,
} from "~/features/learning-plans/hint-validation-preference";
import { ROUTES } from "~/lib/routes";

/** Moderator entry only, development builds. No synthetic data or authentication bypass. */
export default function HintValidationScreen() {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(false);
	if (!isHintValidationAvailable) return <Redirect href="/home" />;
	const choose = async (variant: HintVariant, destination: "new" | "draft") => {
		if (busy) return;
		setBusy(true);
		setError(false);
		try {
			await writeHintVariant(variant);
			router.replace(
				destination === "new" ? ROUTES.createExam : ROUTES.learningPlans,
			);
		} catch {
			setError(true);
			setBusy(false);
		}
	};
	return (
		<Screen>
			<ScreenScroll>
				<View className="gap-5">
					<Text
						accessibilityRole="header"
						className="font-poppins font-semibold text-body-1 text-text"
					>
						Hinweisvergleich · Moderation
					</Text>
					<Text className="font-poppins text-body-3 text-secondary-text">
						Vor der Sitzung wählen, dann das Gerät übergeben. Die Wahl gilt auf
						diesem Testgerät bis zur nächsten Änderung, auch für wiedergeöffnete
						Entwürfe. Beispiele: Version 1. Keine Schülerdaten werden
						zurückgesetzt.
					</Text>
					{(
						[
							["inline", "Inline"],
							["extra", "Extraansicht"],
						] as const
					).map(([variant, label]) => (
						<View key={variant} className="gap-3">
							<Text className="font-poppins font-semibold text-body-2 text-text">
								{label}
							</Text>
							<Button
								disabled={busy}
								onPress={() => void choose(variant, "new")}
							>
								<Text>{label}: neue Prüfung</Text>
							</Button>
							<Button
								variant="cancel"
								disabled={busy}
								onPress={() => void choose(variant, "draft")}
							>
								<Text>{label}: Entwurf öffnen</Text>
							</Button>
						</View>
					))}
					<Text className="font-poppins text-body-3 text-secondary-text">
						Für den zweiten Fall eine neue Prüfung anlegen. „Entwurf öffnen“
						erhält alle Inhalte und zeigt die Planliste zur Auswahl. Nach dem
						Test hier wieder Inline wählen. Im Schülerflow erscheint kein
						Variantenumschalter.
					</Text>
					{error ? (
						<Text
							accessibilityRole="alert"
							className="font-poppins text-body-3 text-destructive"
						>
							Variante konnte nicht gespeichert werden. Bitte erneut wählen.
						</Text>
					) : null}
				</View>
			</ScreenScroll>
		</Screen>
	);
}
