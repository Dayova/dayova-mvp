import { ActivityIndicator, View } from "react-native";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";

export function MaterialUpdatePanel({
	pending,
	busy,
	error,
	additionalMinutes,
	uncoveredTopics = [],
	result,
	onApply,
	showAction = true,
}: {
	pending: boolean;
	busy: boolean;
	error?: string;
	additionalMinutes?: number;
	uncoveredTopics?: string[];
	result: string | null;
	onApply: () => void;
	showAction?: boolean;
}) {
	return (
		<View className="gap-3">
			<Text className="text-body-3 text-secondary-text">
				Materialänderungen werden sofort gespeichert. Bestehende Aufgaben und
				Lernkarten ändern sich erst, wenn du die Änderungen für das weitere
				Lernen berücksichtigst.
			</Text>
			{pending || busy ? (
				<View className="gap-3 rounded-[24px] border border-border bg-card p-4">
					<Text
						accessibilityLiveRegion="polite"
						className="font-semibold text-body-3"
					>
						{busy
							? "Material wird analysiert …"
							: "Material geändert – dein Lernplan wurde noch nicht aktualisiert."}
					</Text>
					<Text className="text-body-3 text-secondary-text">
						Wir aktualisieren noch nicht begonnene Lerninhalte. Begonnene und
						erledigte Inhalte, dein Lernfortschritt und deine Termine bleiben
						erhalten. Zusätzliche Lernzeit wird nur vorgeschlagen.
					</Text>
					{showAction ? (
						<Button
							onPress={onApply}
							disabled={busy}
							accessibilityLabel="Für weiteres Lernen berücksichtigen"
							accessibilityState={{ busy }}
						>
							{busy ? (
								<ActivityIndicator color="#FFFFFF" />
							) : (
								<Text className="shrink text-center">
									Für weiteres Lernen berücksichtigen
								</Text>
							)}
						</Button>
					) : null}
				</View>
			) : null}
			{error ? (
				<Text
					accessibilityRole="alert"
					className="text-body-3 text-destructive"
				>
					{error}
				</Text>
			) : null}
			{!pending && result ? (
				<Text
					accessibilityLiveRegion="polite"
					className="text-body-3 text-secondary-text"
				>
					{result}
				</Text>
			) : null}
			{!pending && uncoveredTopics.length > 0 ? (
				<Text className="text-body-3 text-secondary-text">
					Für diese Themen fehlt noch ein Lernblock:{" "}
					{uncoveredTopics.join(", ")}. Füge dafür in der Lernplanübersicht
					einen Lerntermin hinzu.
				</Text>
			) : null}
			{!pending && (additionalMinutes ?? 0) > 0 ? (
				<Text className="text-body-3 text-secondary-text">
					Vorschlag: Plane etwa {additionalMinutes} zusätzliche Minuten ein. Du
					kannst dafür in der Lernplanübersicht einen weiteren Lerntermin
					hinzufügen. Deine Termine wurden nicht verändert.
				</Text>
			) : null}
		</View>
	);
}
