import "~/global.css";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { PodcastScript } from "#convex/podcastContent";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { DayovaThemeProvider } from "~/lib/theme";
import { PodcastPlayer, PodcastStudyContent } from "./podcast-episode";
import previewScript from "./podcast-preview-script.json";

export function PodcastPreview() {
	const [fontsLoaded] = useFonts({
		Poppins: require("../../../assets/fonts/Poppins-Regular.ttf"),
		"Poppins-SemiBold": require("../../../assets/fonts/Poppins-SemiBold.ttf"),
	});
	const [reading, setReading] = useState(false);
	const [answers, setAnswers] = useState<number[]>([]);
	const [position, setPosition] = useState(0);
	useEffect(() => {
		if (fontsLoaded) void SplashScreen.hideAsync();
	}, [fontsLoaded]);
	if (!fontsLoaded) return null;
	return (
		<GestureHandlerRootView className="flex-1">
			<SafeAreaProvider>
				<DayovaThemeProvider>
					<SafeAreaView className="flex-1 bg-background">
						<ScrollView contentContainerClassName="gap-6 px-6 py-6">
							<View className="gap-3">
								<Text className="font-poppins font-semibold text-body-4 text-primary">
									LOKALE HÖRPROBE · DEUTSCH
								</Text>
								<Text
									accessibilityRole="header"
									className="font-poppins font-semibold text-heading-2 text-text"
								>
									Metaphern verstehen
								</Text>
								<Text selectable className="text-body-3 text-secondary-text">
									Simulator-Vorschau mit Beispieldialog und lokalen
									Systemstimmen. Die echte Podcastfunktion erzeugt das Gespräch
									aus deiner Theorie mit Vertex AI.
								</Text>
							</View>
							<View className="flex-row gap-3">
								<Button
									variant={reading ? "default" : "neutral"}
									className="flex-1"
									onPress={() => setReading(true)}
								>
									<Text>Lesen</Text>
								</Button>
								<Button
									variant={reading ? "neutral" : "default"}
									className="flex-1"
									onPress={() => setReading(false)}
								>
									<Text>Anhören</Text>
								</Button>
							</View>
							{reading ? (
								<View className="gap-4 rounded-card bg-card p-5">
									<Text
										accessibilityRole="header"
										className="font-poppins font-semibold text-heading-2 text-text"
									>
										Was ist eine Metapher?
									</Text>
									<Text selectable className="text-body-2 text-text">
										Eine Metapher überträgt Bedeutung von einem Bereich auf
										einen anderen. „Ein Meer aus Menschen“ beschreibt eine große
										Menschenmenge. Es gibt kein echtes Wasser. Erkläre in einer
										Analyse, welches Bild entsteht und was es im Text bewirkt.
										Ein Vergleich verbindet die Bereiche ausdrücklich, etwa mit
										„wie“: „Die Menge wogte wie ein Meer.“
									</Text>
								</View>
							) : (
								<PodcastPlayer
									url={require("../../../assets/podcast-preview.m4a")}
									title="Metaphern verstehen · Lokale Hörprobe"
									initialPosition={position}
									onProgress={async (seconds) => setPosition(seconds)}
								/>
							)}
							<PodcastStudyContent
								script={previewScript as PodcastScript}
								answers={answers}
								onAnswer={(question, option) =>
									setAnswers((previous) =>
										previewScript.questions.map((_, index) =>
											index === question ? option : (previous[index] ?? -1),
										),
									)
								}
							/>
							<Text selectable className="text-body-4 text-secondary-text">
								Diese Vorschau speichert keine Daten im Lernplan. Starte Metro
								ohne EXPO_PUBLIC_PODCAST_PREVIEW, um zur normalen App
								zurückzukehren.
							</Text>
						</ScrollView>
					</SafeAreaView>
				</DayovaThemeProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}
