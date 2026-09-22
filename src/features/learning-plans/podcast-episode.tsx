import {
	type AudioSource,
	setAudioModeAsync,
	useAudioPlayer,
	useAudioPlayerStatus,
} from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";

export function formatPodcastTime(seconds: number) {
	const value = Math.max(0, Math.floor(seconds));
	return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export function PodcastPlayer({
	url,
	title,
	initialPosition,
	onProgress,
	onFinished,
	caption = "KI-Lerngespräch · zwei synthetische Stimmen",
}: {
	url: AudioSource;
	title: string;
	initialPosition: number;
	onProgress: (seconds: number) => Promise<unknown>;
	onFinished?: () => void;
	caption?: string;
}) {
	const { colors } = useDayovaTheme();
	const player = useAudioPlayer(url, { updateInterval: 1000 });
	const status = useAudioPlayerStatus(player);
	const [speed, setSpeed] = useState(1);
	const [error, setError] = useState<string | null>(null);
	const restored = useRef(false);
	const restorePosition = useRef(initialPosition);
	const lastSaved = useRef(initialPosition);
	const latestPosition = useRef(initialPosition);
	const progressRef = useRef(onProgress);
	const finishedRef = useRef(onFinished);
	useEffect(() => {
		finishedRef.current = onFinished;
	}, [onFinished]);
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
		latestPosition.current = status.currentTime;
		if (status.didJustFinish) finishedRef.current?.();
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
				void progressRef.current(latestPosition.current).catch(() => undefined);
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
		<View className="gap-4 rounded-card border border-border bg-card p-6">
			<Text
				selectable
				className="font-poppins font-semibold text-body-2 text-text"
			>
				Mira & Noah
			</Text>
			<Text selectable className="text-body-4 text-secondary-text">
				{caption}
			</Text>
			<View
				className="h-2 overflow-hidden rounded-full bg-system-subtle"
				accessibilityRole="progressbar"
				accessibilityLabel="Hörfortschritt"
				accessibilityValue={{
					min: 0,
					max: Math.round(status.duration),
					now: Math.round(status.currentTime),
				}}
			>
				<View
					className="h-full rounded-full bg-primary"
					// Playback progress is a runtime measurement, not a spacing token.
					style={{
						width: `${status.duration ? Math.min(100, Math.max(0, (status.currentTime / status.duration) * 100)) : 0}%`,
					}}
				/>
			</View>
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
					variant="ghost"
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
					<Text className="text-body-3">15 Sek. zurück</Text>
				</Button>
				<Button
					variant="ghost"
					className="min-w-32 flex-1"
					accessibilityLabel={`Geschwindigkeit: ${speed}-fach. Ändern`}
					onPress={() => {
						const next = speed === 1.5 ? 0.75 : speed + 0.25;
						player.setPlaybackRate(next);
						setSpeed(next);
					}}
				>
					<Text className="text-body-3">{speed}× Tempo</Text>
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
