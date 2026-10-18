import { useState } from "react";
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
	const [showDetails, setShowDetails] = useState(false);
	return (
		<View className="gap-3">
			{pending || busy ? (
				<View className="gap-3 rounded-[24px] border border-border bg-card p-4">
					<Text
						accessibilityLiveRegion="polite"
						className="font-semibold text-body-3"
					>
						{busy
							? "Material wird analysiert …"
							: "Material gespeichert. Lernplan noch nicht aktualisiert."}
					</Text>
					<Button
						variant="ghost"
						accessibilityState={{ expanded: showDetails }}
						onPress={() => setShowDetails((value) => !value)}
					>
						<Text className="shrink text-center">
							{showDetails ? "Details ausblenden" : "Was wird aktualisiert?"}
						</Text>
					</Button>
					{showDetails ? (
						<Text className="text-body-3 text-secondary-text">
							Nur noch nicht begonnene Lerninhalte. Begonnene Inhalte,
							Fortschritt und Termine bleiben erhalten. Zusätzliche Lernzeit
							wird nur vorgeschlagen.
						</Text>
					) : null}
					{showAction ? (
						<Button
							onPress={onApply}
							disabled={busy}
							accessibilityLabel="Lernplan aktualisieren"
							accessibilityState={{ busy }}
						>
							{busy ? (
								<ActivityIndicator color="#FFFFFF" />
							) : (
								<Text className="shrink text-center">
									Lernplan aktualisieren
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
					Noch ohne Lernblock: {uncoveredTopics.join(", ")}. Ergänze einen
					Lerntermin in der Übersicht.
				</Text>
			) : null}
			{!pending && (additionalMinutes ?? 0) > 0 ? (
				<Text className="text-body-3 text-secondary-text">
					Vorschlag: Plane etwa {additionalMinutes} zusätzliche Minuten ein.
					Ergänze dafür einen Lerntermin in der Übersicht.
				</Text>
			) : null}
		</View>
	);
}
