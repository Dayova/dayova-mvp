import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { api } from "#convex/_generated/api";
import { Button } from "~/components/ui/button";
import { DateTimePickerSheet } from "~/components/ui/date-time-picker-sheet";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { useSheetAccessibility } from "~/components/ui/sheet-accessibility";
import { Text } from "~/components/ui/text";
import { LearningTimeImpactSheet } from "~/features/learning-plans/learning-time-impact-sheet";
import { LearningTimeSuggestionCard } from "~/features/learning-plans/learning-time-suggestion-card";
import { ROUTES, withReturnTo } from "~/lib/routes";

/** One short daily check-in; actual schedule changes still require consent. */
export function LearningRoutineCoach({
	referenceTime,
}: {
	referenceTime: number;
}) {
	const { isAuthenticated } = useConvexAuth();
	const router = useRouter();
	const focused = useIsFocused();
	const hasOpenSheet = useSheetAccessibility()?.hasOpenSheet ?? false;
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
	const [promptOpen, setPromptOpen] = useState(false);
	const shownDay = useRef<string | null>(null);
	const pendingPicker = useRef(false);
	const dismissalSaved = useRef<Promise<unknown> | null>(null);
	useFocusEffect(
		useCallback(
			() => () => {
				// Leaving Today must not reopen an already shown prompt when returning.
				pendingPicker.current = false;
				setPromptOpen(false);
				setPicker(false);
				setSelected(null);
			},
			[],
		),
	);
	const berlinDay = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Berlin",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(referenceTime);
	const berlinTime = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Europe/Berlin",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).format(referenceTime);
	useEffect(() => {
		if (
			!focused ||
			!isAuthenticated ||
			hasOpenSheet ||
			promptOpen ||
			picker ||
			selected ||
			routine?.behavioral ||
			!routine?.session ||
			routine.session.startTime < berlinTime ||
			shownDay.current === berlinDay
		)
			return;
		// Let other app sheets claim presentation first; cancel when focus or data changes.
		const timer = setTimeout(() => {
			shownDay.current = berlinDay;
			dismissalSaved.current = null;
			setChosenSession(routine.session);
			setPromptOpen(true);
		}, 400);
		return () => clearTimeout(timer);
	}, [
		focused,
		isAuthenticated,
		hasOpenSheet,
		promptOpen,
		picker,
		selected,
		routine,
		berlinDay,
		berlinTime,
	]);
	const rememberToday = () => {
		if (!dismissalSaved.current) {
			dismissalSaved.current = dismiss({}).catch((cause: unknown) => {
				dismissalSaved.current = null;
				throw cause;
			});
		}
		return dismissalSaved.current;
	};
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
	const choose = () => {
		if (!chosenSession) return;
		const [hour, minute] = chosenSession.startTime.split(":").map(Number);
		const value = new Date();
		value.setHours(hour, minute, 0, 0);
		setTime(value);
		setSelected(null);
		setError(null);
		pendingPicker.current = true;
		setPromptOpen(false);
	};
	const suggestion = routine?.behavioral;
	return (
		<>
			{suggestion ? (
				<View className="gap-4 px-6 py-4">
					<LearningTimeSuggestionCard
						variant="behavioral"
						entries={suggestion.entries}
						evidenceSessionCount={suggestion.evidenceSessionCount}
						isBusy={busy}
						onConfirm={() => setImpactFingerprint(suggestion.fingerprint)}
						onAdjust={() =>
							router.push(withReturnTo(ROUTES.learningTimes, ROUTES.home))
						}
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
					{error ? <Text accessibilityRole="alert">{error}</Text> : null}
				</View>
			) : null}
			<DayovaSheetFrame
				visible={promptOpen && focused && isAuthenticated}
				title={`Passt dir heute ${chosenSession?.startTime ?? ""} Uhr zum Lernen?`}
				description={`${chosenSession?.title ?? ""} · ${chosenSession?.durationMinutes ?? ""} Minuten`}
				closeAccessibilityLabel="Für heute überspringen"
				dismissible={!busy}
				onPresented={() => void run(rememberToday)}
				onClose={() => {
					setPromptOpen(false);
					void run(rememberToday);
				}}
				onDismiss={() => {
					if (pendingPicker.current) {
						pendingPicker.current = false;
						if (focused) setPicker(true);
					}
				}}
				footer={
					<View className="gap-3">
						<Button
							disabled={busy}
							onPress={() =>
								void run(async () => {
									await rememberToday();
									setPromptOpen(false);
								})
							}
						>
							<Text>Ja, passt</Text>
						</Button>
						<Button
							variant="neutral"
							disabled={busy}
							onPress={() =>
								void run(async () => {
									await rememberToday();
									choose();
								})
							}
						>
							<Text>Andere Uhrzeit</Text>
						</Button>
					</View>
				}
			>
				{error ? <Text accessibilityRole="alert">{error}</Text> : null}
			</DayovaSheetFrame>
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
								router.push(withReturnTo(ROUTES.learningTimes, ROUTES.home));
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
		</>
	);
}
