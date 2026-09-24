import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import { api } from "#convex/_generated/api";
import { Button } from "~/components/ui/button";
import { DateTimePickerSheet } from "~/components/ui/date-time-picker-sheet";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { LearningTimeImpactSheet } from "~/features/learning-plans/learning-time-impact-sheet";
import { LearningTimeSuggestionCard } from "~/features/learning-plans/learning-time-suggestion-card";
import { ROUTES } from "~/lib/routes";

/** Inline, voluntary coaching. It never opens a modal automatically. */
export function LearningRoutineCoach({
	referenceTime,
}: {
	referenceTime: number;
}) {
	const { isAuthenticated } = useConvexAuth();
	const router = useRouter();
	const routine = useQuery(
		api.learningTimes.getHomeRoutine,
		isAuthenticated ? { referenceTime } : "skip",
	);
	const dismiss = useMutation(api.learningTimes.dismissHomeRoutine);
	const respond = useMutation(api.learningTimes.respondToBehavioralSuggestion);
	const move = useMutation(api.learningPlans.moveSessionToday);
	const [impactFingerprint, setImpactFingerprint] = useState<string | null>(
		null,
	);
	const [picker, setPicker] = useState(false);
	const [time, setTime] = useState(new Date());
	const [selected, setSelected] = useState<string | null>(null);
	const [chosenSession, setChosenSession] = useState<NonNullable<
		NonNullable<typeof routine>["session"]
	> | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const gate = useRef(false);
	const run = async (action: () => Promise<unknown>) => {
		if (gate.current) return;
		gate.current = true;
		setBusy(true);
		setError(null);
		try {
			await action();
		} catch {
			setError(
				"Das hat nicht geklappt. Möglicherweise ist die Zeit belegt oder der Lernschritt hat sich geändert. Bitte prüfe deine Auswahl erneut.",
			);
		} finally {
			gate.current = false;
			setBusy(false);
		}
	};
	const choose = (offset: number) => {
		if (!routine?.session) return;
		setChosenSession(routine.session);
		const [hour, minute] = routine.session.startTime.split(":").map(Number);
		const value = new Date();
		value.setHours(hour, minute + offset, 0, 0);
		setTime(value);
		setSelected(null);
		setError(null);
		setPicker(true);
	};
	if (!routine) return null;
	const session = routine.session;
	const suggestion = routine.behavioral;
	return (
		<View className="gap-4 px-6 py-4">
			{suggestion ? (
				<LearningTimeSuggestionCard
					variant="behavioral"
					entries={suggestion.entries}
					evidenceSessionCount={suggestion.evidenceSessionCount}
					isBusy={busy}
					onConfirm={() => setImpactFingerprint(suggestion.fingerprint)}
					onAdjust={() => router.push(ROUTES.learningTimes)}
					onKeep={() =>
						void run(() =>
							respond({
								fingerprint: suggestion.fingerprint,
								response: "keep",
							}),
						)
					}
					onContinue={() =>
						void run(() =>
							respond({
								fingerprint: suggestion.fingerprint,
								response: "later",
							}),
						)
					}
				/>
			) : session ? (
				<Surface variant="soft" className="gap-3 rounded-[28px] p-5">
					<Text
						accessibilityRole="header"
						className="font-semibold text-body-2 text-text"
					>
						Passt dir heute {session.startTime} Uhr?
					</Text>
					<Text className="text-body-3 text-secondary-text">
						Für „{session.title}“ sind {session.durationMinutes} Minuten
						geplant. Du kannst jederzeit lernen. Eine feste Zeit kann dir
						helfen, regelmäßig dranzubleiben.
					</Text>
					<Button
						disabled={busy}
						onPress={() =>
							router.push(
								`/learning-plans/${session.planId}/sessions/${session.id}`,
							)
						}
					>
						<Text>Jetzt lernen</Text>
					</Button>
					<Button variant="neutral" disabled={busy} onPress={() => choose(-30)}>
						<Text>Lieber früher</Text>
					</Button>
					<Button variant="neutral" disabled={busy} onPress={() => choose(30)}>
						<Text>Lieber später</Text>
					</Button>
					<Button
						variant="neutral"
						disabled={busy}
						onPress={() => void run(() => dismiss({}))}
					>
						<Text>Heute nicht nachfragen</Text>
					</Button>
				</Surface>
			) : null}
			{error ? <Text accessibilityRole="alert">{error}</Text> : null}
			<DateTimePickerSheet
				visible={picker}
				mode="time"
				value={time}
				doneLabel="Auswahl prüfen"
				onChange={(_, date) => {
					if (date) setTime(date);
				}}
				onClose={() => setPicker(false)}
				onConfirm={(date) =>
					setSelected(
						`${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
					)
				}
			/>
			<DayovaSheetFrame
				visible={selected !== null && !!chosenSession}
				dismissible={!busy}
				onClose={() => setSelected(null)}
				title="Nur heute oder regelmäßig?"
				description={`Heute: ${chosenSession?.startTime} → ${selected} Uhr. Nur diese Einheit wird verschoben; Dauer und Lernfortschritt bleiben erhalten. Die Uhrzeit gilt für Europe/Berlin.`}
				footer={
					<View className="gap-3">
						<Button
							disabled={busy || !chosenSession}
							onPress={() =>
								void run(async () => {
									if (!chosenSession || !selected) return;
									await move({
										sessionId: chosenSession.id,
										startTime: selected,
										expectedUpdatedAt: chosenSession.updatedAt,
									});
									setSelected(null);
								})
							}
						>
							<Text>Nur heute übernehmen</Text>
						</Button>
						<Button
							variant="neutral"
							disabled={busy}
							onPress={() => {
								setSelected(null);
								router.push(ROUTES.learningTimes);
							}}
						>
							<Text>Regelmäßige Zeiten einstellen</Text>
						</Button>
						<Button
							variant="neutral"
							disabled={busy}
							onPress={() => setSelected(null)}
						>
							<Text>Abbrechen</Text>
						</Button>
					</View>
				}
			>
				<Text>
					Beim Übernehmen prüft Dayova Überschneidungen. Deine regelmäßigen
					Lernzeiten werden hier nicht automatisch geändert. Benachrichtigungen
					steuerst du separat in den Einstellungen.
				</Text>
				{error ? <Text accessibilityRole="alert">{error}</Text> : null}
			</DayovaSheetFrame>
			<LearningTimeImpactSheet
				fingerprint={impactFingerprint}
				referenceTime={referenceTime}
				onClose={() => setImpactFingerprint(null)}
			/>
		</View>
	);
}
