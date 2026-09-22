import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { useAiConsent } from "~/context/AiConsentContext";
import {
	PodcastPlayer,
	PodcastStudyContent,
} from "~/features/learning-plans/podcast-episode";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { openExternalUrl } from "~/lib/open-external-url";
import { useDayovaTheme } from "~/lib/theme";

export default function LearningPodcastScreen() {
	const { planId, sessionId } = useLocalSearchParams<{
		planId: string;
		sessionId: string;
	}>();
	const router = useRouter();
	const { colors } = useDayovaTheme();
	const { isAuthenticated } = useConvexAuth();
	const { requestAiConsent } = useAiConsent();
	const snapshot = useQuery(
		api.learningPodcasts.get,
		isAuthenticated && sessionId
			? { sessionId: sessionId as Id<"learningPlanSessions"> }
			: "skip",
	);
	const request = useMutation(api.learningPodcasts.request);
	const confirmLanguageSubject = useMutation(
		api.learningPodcasts.confirmLanguageSubject,
	);
	const progress = useMutation(api.learningPodcasts.saveProgress);
	const answer = useMutation(api.learningPodcasts.answer);
	const sources = useQuery(
		api.learningPodcasts.sources,
		isAuthenticated && sessionId
			? { sessionId: sessionId as Id<"learningPlanSessions"> }
			: "skip",
	);
	const openSource = useAction(api.learningPodcasts.openSource);
	const gate = useRef(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const episode = snapshot?.episode;
	async function run(operation: () => Promise<unknown>) {
		if (gate.current) return;
		gate.current = true;
		setBusy(true);
		setError(null);
		try {
			await operation();
		} catch (error) {
			setError(
				getErrorMessage(
					error,
					"Das hat nicht funktioniert. Bitte versuche es erneut.",
				),
			);
		} finally {
			gate.current = false;
			setBusy(false);
		}
	}
	const generating =
		episode?.status === "script" || episode?.status === "audio";
	return (
		<ScrollView
			className="flex-1 bg-background"
			contentInsetAdjustmentBehavior="automatic"
			contentContainerClassName="gap-6 px-6 pt-6 pb-12"
		>
			<Stack.Screen
				options={{
					headerShown: true,
					title: "Podcast",
					headerBackTitle: "Zurück",
					headerTintColor: colors.text,
					headerStyle: { backgroundColor: colors.background },
				}}
			/>
			<View className="gap-3">
				<Text
					selectable
					className="font-poppins font-semibold text-body-4 text-primary"
				>
					KI-LERNGESPRÄCH
				</Text>
				<Text
					selectable
					accessibilityRole="header"
					className="font-poppins font-semibold text-heading-2 text-text"
				>
					Deine Theorie zum Anhören
				</Text>
				<Text selectable className="text-body-3 text-secondary-text">
					Ein Gespräch auf Basis deiner Theorie und Lernziele. Die Stimmen und
					Inhalte werden mit KI erstellt.
				</Text>
			</View>
			<View className="flex-row gap-3">
				<Button
					className="flex-1"
					variant="neutral"
					onPress={() =>
						router.replace(`/learning-plans/${planId}/sessions/${sessionId}`)
					}
				>
					<Text>Lesen</Text>
				</Button>
				<Button
					className="flex-1"
					accessibilityState={{ selected: true }}
					disabled
				>
					<Text>Anhören</Text>
				</Button>
			</View>
			{!snapshot ? (
				<ActivityIndicator
					accessibilityLabel="Podcast wird geladen"
					color={colors.primary}
				/>
			) : snapshot.needsLanguageConfirmation ? (
				<View className="gap-3">
					<Text>
						Ist dein selbst benanntes Fach ein Sprachfach? Bestätige es einmal
						für diesen Lernplan, um Podcasts zu nutzen.
					</Text>
					<Button
						disabled={busy}
						onPress={() =>
							void run(() =>
								confirmLanguageSubject({
									sessionId: sessionId as Id<"learningPlanSessions">,
								}),
							)
						}
					>
						<Text>Das ist ein Sprachfach</Text>
					</Button>
				</View>
			) : !snapshot.eligible ? (
				<Text selectable className="text-body-2 text-secondary-text">
					Podcasts stehen für Theorie-Einheiten in sprachlichen Fächern zur
					Verfügung.
				</Text>
			) : (
				<>
					{generating ? (
						<View
							className="gap-3 rounded-card bg-theorie-subtle p-5"
							accessibilityLiveRegion="polite"
						>
							<ActivityIndicator color={colors.primary} />
							<Text className="font-poppins font-semibold text-body-2 text-text">
								{episode.status === "script"
									? "Dein Lerngespräch entsteht"
									: "Die KI-Stimmen werden vorbereitet"}
							</Text>
							<Text className="text-body-3 text-secondary-text">
								Das kann einige Minuten dauern. Du kannst diese Seite verlassen
								und später zurückkommen.
							</Text>
						</View>
					) : episode?.status === "ready" && episode.audioUrl ? (
						<PodcastPlayer
							key={episode._id}
							url={episode.audioUrl}
							title="Deine Theorie · KI-Lerngespräch"
							initialPosition={episode.positionSeconds}
							onProgress={(positionSeconds) =>
								progress({ podcastId: episode._id, positionSeconds })
							}
						/>
					) : (
						<View className="gap-4 rounded-card bg-card p-5">
							<Text selectable className="text-body-2 text-text">
								{episode?.error ??
									"Lass dir die Theorie als kurzes Gespräch zwischen Mira und Noah erklären."}
							</Text>
							<Button
								disabled={busy}
								accessibilityState={{ busy }}
								onPress={() =>
									void run(async () => {
										if (await requestAiConsent())
											await request({
												sessionId: sessionId as Id<"learningPlanSessions">,
											});
									})
								}
							>
								<Text>
									{busy
										? "Wird gestartet …"
										: episode
											? "Erneut versuchen"
											: "Podcast erstellen"}
								</Text>
							</Button>
						</View>
					)}
					{episode?.script && episode.status === "ready" ? (
						<PodcastStudyContent
							script={episode.script}
							answers={episode.answers}
							disabled={busy}
							onAnswer={(questionIndex, optionIndex) =>
								void run(() =>
									answer({
										podcastId: episode._id,
										questionIndex,
										optionIndex,
									}),
								)
							}
						/>
					) : null}
				</>
			)}
			{error ? (
				<Text
					selectable
					accessibilityRole="alert"
					className="text-body-3 text-wrong"
				>
					{error}
				</Text>
			) : null}
			<Text selectable className="text-body-4 text-secondary-text">
				Grundlage ist die Theorie dieser Lerneinheit aus deinen
				Schulmaterialien. Im Lesemodus findest du die Erklärung, Beispiele und
				Merksätze.
			</Text>
			{sources?.length ? (
				<View className="gap-3">
					<Text
						accessibilityRole="header"
						className="font-poppins font-semibold text-body-2 text-text"
					>
						Deine Materialien
					</Text>
					{sources.map((source) => (
						<Button
							key={source.id}
							variant="neutral"
							disabled={busy}
							onPress={() =>
								void run(async () => {
									const url = await openSource({ documentId: source.id });
									if (!(await openExternalUrl(url)))
										throw new Error(
											"Das Material konnte nicht geöffnet werden.",
										);
								})
							}
						>
							<Text>{source.fileName}</Text>
						</Button>
					))}
				</View>
			) : null}
			<Button
				variant="neutral"
				onPress={() =>
					router.replace(`/learning-plans/${planId}/sessions/${sessionId}`)
				}
			>
				<Text>In der Theorie weiterlernen</Text>
			</Button>
		</ScrollView>
	);
}
