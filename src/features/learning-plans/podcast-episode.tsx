import {
	setAudioModeAsync,
	useAudioPlayer,
	useAudioPlayerStatus,
} from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, View } from "react-native";
import type { PodcastScript } from "#convex/podcastContent";
import { Button } from "~/components/ui/button";
import { FlowProgressBar } from "~/components/ui/flow-progress-bar";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

export function formatPodcastTime(seconds: number) {
	const value = Math.max(0, Math.floor(seconds));
	return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export function PodcastPlayer({
	url,
	title,
	initialPosition,
	onProgress,
}: {
	url: string;
	title: string;
	initialPosition: number;
	onProgress: (seconds: number) => Promise<unknown>;
}) {
	const { colors } = useDayovaTheme();
	const player = useAudioPlayer(url, { updateInterval: 1000 });
	const status = useAudioPlayerStatus(player);
	const [speed, setSpeed] = useState(1);
	const [error, setError] = useState<string | null>(null);
	const restored = useRef(false);
	const restorePosition = useRef(initialPosition);
	const lastSaved = useRef(initialPosition);
	const progressRef = useRef(onProgress);
	useEffect(() => {
		progressRef.current = onProgress;
	}, [onProgress]);
	useEffect(() => {
		if (!status.isLoaded || restored.current) return;
		restored.current = true;
		void player
			.seekTo(Math.min(restorePosition.current, status.duration))
			.catch(() =>
				setError("Die Wiedergabeposition konnte nicht geladen werden."),
			);
	}, [player, status.isLoaded, status.duration]);
	useEffect(() => {
		if (!restored.current || !status.isLoaded) return;
		if (
			Math.abs(status.currentTime - lastSaved.current) >= 10 ||
			status.didJustFinish
		) {
			lastSaved.current = status.currentTime;
			void progressRef
				.current(status.currentTime)
				.catch(() =>
					setError(
						"Dein Hörfortschritt konnte nicht gespeichert werden. Prüfe deine Verbindung.",
					),
				);
		}
	}, [status.currentTime, status.didJustFinish, status.isLoaded]);
	useEffect(() => {
		const subscription = AppState.addEventListener("change", (state) => {
			if (state !== "active" && restored.current)
				void progressRef.current(player.currentTime).catch(() => undefined);
		});
		return () => {
			subscription.remove();
			if (restored.current)
				void progressRef.current(player.currentTime).catch(() => undefined);
		};
	}, [player]);
	async function toggle() {
		setError(null);
		try {
			if (status.playing) {
				player.pause();
				await onProgress(player.currentTime);
			} else {
				await setAudioModeAsync({
					playsInSilentMode: true,
					shouldPlayInBackground: true,
					interruptionMode: "doNotMix",
				});
				player.setActiveForLockScreen(true, {
					title,
					artist: "Dayova · KI-Lerngespräch",
				});
				if (player.currentTime >= status.duration - 0.5) await player.seekTo(0);
				player.play();
			}
		} catch {
			setError(
				"Die Wiedergabe konnte nicht gestartet werden. Versuche es erneut.",
			);
		}
	}
	return (
		<View className="gap-4 rounded-card border border-border bg-card p-5">
			<Text
				selectable
				className="font-poppins font-semibold text-body-2 text-text"
			>
				Mira & Noah
			</Text>
			<Text selectable className="text-body-4 text-secondary-text">
				Zwei KI-Stimmen erklären und hinterfragen deine Theorie.
			</Text>
			<FlowProgressBar
				progress={status.duration ? status.currentTime / status.duration : 0}
				accessibilityRole="progressbar"
				accessibilityLabel="Hörfortschritt"
				accessibilityValue={{
					min: 0,
					max: Math.round(status.duration),
					now: Math.round(status.currentTime),
				}}
			/>
			<Text selectable className="text-body-4 text-secondary-text">
				{formatPodcastTime(status.currentTime)} /{" "}
				{formatPodcastTime(status.duration)}
			</Text>
			{!status.isLoaded && !status.error ? (
				<ActivityIndicator
					color={colors.primary}
					accessibilityLabel="Audio wird geladen"
				/>
			) : null}
			<Button
				disabled={!status.isLoaded || Boolean(status.error)}
				onPress={() => void toggle()}
				accessibilityLabel={
					status.playing ? "Podcast pausieren" : "Podcast abspielen"
				}
			>
				<Text>{status.playing ? "Pause" : "Abspielen"}</Text>
			</Button>
			<View className="flex-row flex-wrap gap-3">
				<Button
					variant="neutral"
					className="min-w-32 flex-1"
					disabled={!status.isLoaded}
					onPress={() =>
						void player
							.seekTo(Math.max(0, status.currentTime - 15))
							.catch(() =>
								setError("Zurückspringen nicht möglich. Versuche es erneut."),
							)
					}
				>
					<Text>15 Sek. zurück</Text>
				</Button>
				<Button
					variant="neutral"
					className="min-w-32 flex-1"
					accessibilityLabel={`Geschwindigkeit: ${speed}-fach. Ändern`}
					onPress={() => {
						const next = speed === 1.5 ? 0.75 : speed + 0.25;
						player.setPlaybackRate(next);
						setSpeed(next);
					}}
				>
					<Text>{speed}× Tempo</Text>
				</Button>
			</View>
			{status.error ? (
				<>
					<Text
						selectable
						accessibilityRole="alert"
						className="text-body-3 text-wrong"
					>
						Das Audio konnte nicht geladen werden. Prüfe deine Verbindung.
					</Text>
					<Button
						variant="neutral"
						onPress={() => {
							restored.current = false;
							player.replace(url);
						}}
					>
						<Text>Audio erneut laden</Text>
					</Button>
				</>
			) : null}
			{error ? (
				<Text
					selectable
					accessibilityRole="alert"
					className="text-body-3 text-wrong"
				>
					{error}
				</Text>
			) : null}
		</View>
	);
}

export function PodcastStudyContent({
	script,
	answers,
	onAnswer,
	disabled = false,
}: {
	script: PodcastScript;
	answers: number[];
	onAnswer: (question: number, option: number) => void;
	disabled?: boolean;
}) {
	const [showTranscript, setShowTranscript] = useState(false);
	return (
		<View className="gap-6">
			<Button
				variant="neutral"
				accessibilityState={{ expanded: showTranscript }}
				onPress={() => setShowTranscript((value) => !value)}
			>
				<Text>
					{showTranscript ? "Transkript schließen" : "Transkript mitlesen"}
				</Text>
			</Button>
			{showTranscript ? (
				<View className="gap-5 rounded-card bg-card p-5">
					{script.turns.map((turn, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: A generated transcript is immutable and may repeat the same sentence.
						<View key={`${index}-${turn.speaker}`} className="gap-1">
							<Text className="font-poppins font-semibold text-body-4 text-primary">
								{turn.speaker}
							</Text>
							<Text selectable className="text-body-2 text-text">
								{turn.text}
							</Text>
						</View>
					))}
				</View>
			) : null}
			<Text
				accessibilityRole="header"
				className="font-poppins font-semibold text-heading-2 text-text"
			>
				Was hast du mitgenommen?
			</Text>
			<Text selectable className="text-body-3 text-secondary-text">
				Teste dein Verständnis. Anhören allein schließt deine Lerneinheit nicht
				ab.
			</Text>
			{script.questions.map((question, questionIndex) => {
				const answer = answers[questionIndex] ?? -1;
				return (
					<View
						key={question.prompt}
						className="gap-3 rounded-card bg-card p-5"
					>
						<Text
							selectable
							className="font-poppins font-semibold text-body-2 text-text"
						>
							{questionIndex + 1}. {question.prompt}
						</Text>
						{question.options.map((option, optionIndex) => (
							<Pressable
								key={option}
								disabled={disabled}
								accessibilityRole="radio"
								accessibilityLabel={option}
								accessibilityState={{
									checked: answer === optionIndex,
									disabled,
								}}
								onPress={() => onAnswer(questionIndex, optionIndex)}
								className={cn(
									"min-h-12 justify-center rounded-2xl border border-border p-4",
									answer === optionIndex && "border-primary bg-system-subtle",
								)}
							>
								<Text className="text-body-3 text-text">{option}</Text>
							</Pressable>
						))}
						{answer >= 0 ? (
							<Text
								selectable
								accessibilityLiveRegion="polite"
								className="text-body-3 text-secondary-text"
							>
								{answer === question.correctIndex
									? "Richtig. "
									: "Noch nicht ganz. "}
								{question.explanation}
							</Text>
						) : null}
					</View>
				);
			})}
		</View>
	);
}
