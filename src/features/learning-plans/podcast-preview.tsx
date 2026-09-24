import "~/global.css";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { ScrollView } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { PodcastScript } from "#convex/podcastContent";
import { DayovaThemeProvider } from "~/lib/theme";
import { PodcastLesson } from "./podcast-lesson";
import previewScript from "./podcast-preview-script.json";

export function PodcastPreview() {
	const [fontsLoaded] = useFonts({
		Poppins: require("../../../assets/fonts/Poppins-Regular.ttf"),
		"Poppins-SemiBold": require("../../../assets/fonts/Poppins-SemiBold.ttf"),
	});
	const [answers, setAnswers] = useState<number[]>([]);
	const [position, setPosition] = useState(0);
	const [listened, setListened] = useState(false);
	const [iteration, setIteration] = useState(0);
	const scroll = useRef<ScrollView>(null);
	useEffect(() => {
		if (fontsLoaded) void SplashScreen.hideAsync();
	}, [fontsLoaded]);
	if (!fontsLoaded) return null;
	return (
		<GestureHandlerRootView className="flex-1">
			<SafeAreaProvider>
				<DayovaThemeProvider>
					<SafeAreaView className="flex-1 bg-background">
						<ScrollView
							ref={scroll}
							contentContainerClassName="gap-6 px-6 py-6"
						>
							<PodcastLesson
								key={iteration}
								preview
								title="Metaphern verstehen"
								goal="Erkenne sprachliche Bilder und erkläre ihre Wirkung im Text."
								script={previewScript as PodcastScript}
								audio={require("../../../assets/podcast-preview.m4a")}
								position={position}
								listened={listened}
								answers={answers}
								onProgress={async (seconds) => {
									setPosition(seconds);
									if (seconds >= 64) setListened(true);
								}}
								onAnswer={async (question, option) =>
									setAnswers((previous) =>
										previewScript.questions.map((_, index) =>
											index === question ? option : (previous[index] ?? -1),
										),
									)
								}
								onExit={() => {
									setIteration(iteration + 1);
									setPosition(0);
									setListened(false);
									setAnswers([]);
									scroll.current?.scrollTo({ y: 0, animated: false });
								}}
								onStageChange={() =>
									scroll.current?.scrollTo({ y: 0, animated: false })
								}
							/>
						</ScrollView>
					</SafeAreaView>
				</DayovaThemeProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}
