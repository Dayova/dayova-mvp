import { useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { View } from "react-native";
import { api } from "#convex/_generated/api";
import { Button } from "~/components/ui/button";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { Text } from "~/components/ui/text";

export function LearningTimeImpactSheet({
	fingerprint,
	referenceTime,
	onClose,
}: {
	fingerprint: string | null;
	referenceTime: number;
	onClose: () => void;
}) {
	const impact = useQuery(
		api.learningTimes.previewBehavioralSuggestion,
		fingerprint ? { fingerprint, referenceTime } : "skip",
	);
	const apply = useMutation(api.learningTimes.applyBehavioralSuggestion);
	const gate = useRef(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const confirm = async () => {
		if (gate.current || !fingerprint || !impact || impact.conflicts.length)
			return;
		gate.current = true;
		setBusy(true);
		setError(null);
		try {
			await apply({ fingerprint, expectedImpactRevision: impact.revision });
			onClose();
		} catch {
			setError(
				"Dein Plan konnte nicht geändert werden. Bitte schließe die Vorschau und prüfe sie erneut. Deine bisherigen Zeiten bleiben erhalten.",
			);
		} finally {
			gate.current = false;
			setBusy(false);
		}
	};
	const changes =
		impact?.changes.filter(
			(change) =>
				change.dateKey !== change.previousDateKey ||
				change.startTime !== change.previousStartTime,
		) ?? [];
	return (
		<DayovaSheetFrame
			visible={!!fingerprint}
			onClose={onClose}
			dismissible={!busy}
			scrollable
			title="Was ändert sich?"
			description="Nur noch nicht gestartete Lernschritte werden verschoben. Dein Lernfortschritt bleibt erhalten."
			footer={
				<View className="gap-3">
					<Button
						disabled={!impact || !!impact.conflicts.length || busy}
						accessibilityState={{
							busy,
							disabled: !impact || !!impact.conflicts.length || busy,
						}}
						onPress={() => void confirm()}
					>
						<Text>{busy ? "Wird übernommen …" : "Änderungen übernehmen"}</Text>
					</Button>
					<Button variant="neutral" disabled={busy} onPress={onClose}>
						<Text>Abbrechen</Text>
					</Button>
				</View>
			}
		>
			<View className="gap-4">
				{impact === undefined ? (
					<Text>Auswirkungen werden geprüft …</Text>
				) : impact === null ? (
					<Text>
						Dieser Vorschlag ist nicht mehr aktuell. Bitte öffne ihn erneut.
					</Text>
				) : (
					<>
						<Text>
							{changes.length} geplante Lernschritte würden verschoben.
						</Text>
						{changes.map((change) => (
							<View key={change.sessionId} className="gap-1">
								<Text className="font-semibold text-body-3 text-text">
									{change.title}
								</Text>
								<Text className="text-body-4 text-secondary-text">
									{change.previousDateKey} · {change.previousStartTime} →{" "}
									{change.dateKey} · {change.startTime}
								</Text>
							</View>
						))}
						{impact.conflicts.map((conflict) => (
							<Text
								key={conflict.sessionId}
								accessibilityRole="alert"
								className="text-body-3 text-destructive"
							>
								{conflict.title}: kein freier Termin vor der Prüfung am{" "}
								{conflict.examDateKey}. Bitte wähle andere Lernzeiten.
							</Text>
						))}
						<Text className="text-body-4 text-secondary-text">
							Die Vorschau prüft bereits geplante Einheiten, nicht die
							vollständige Vorbereitung bis zur Prüfung. Benachrichtigungen
							bleiben separat einstellbar.
						</Text>
					</>
				)}
				{error ? (
					<Text
						accessibilityRole="alert"
						className="text-body-3 text-destructive"
					>
						{error}
					</Text>
				) : null}
			</View>
		</DayovaSheetFrame>
	);
}
