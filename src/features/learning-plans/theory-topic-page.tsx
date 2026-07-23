import * as Speech from "expo-speech";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	TouchableOpacity,
	View,
} from "react-native";
import Animated, {
	FadeInDown,
	useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { FlowProgressBar } from "~/components/ui/flow-progress-bar";
import {
	BookOpen,
	Bulb,
	CircleAlert,
	Pencil,
	Stop,
	VolumeHigh,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";
import {
	adaptTheoryTopic,
	buildTheorySpeechText,
	getTheoryTopicNavigation,
	splitTheorySpeechText,
} from "./theory-topic";
import type { SessionContentItem } from "./types";

const SPEECH_ERROR_MESSAGE =
	"Vorlesen ist gerade nicht verfügbar. Lies das Thema selbst weiter oder versuche es erneut.";

type TheoryTopicPageProps = {
	item: SessionContentItem;
	currentIndex: number;
	total: number;
	isCompleting: boolean;
	onPrevious: () => void;
	onNext: () => void;
};

function TopicSectionTitle({
	icon,
	children,
}: {
	icon: React.ReactNode;
	children: string;
}) {
	return (
		<View className="flex-row items-center gap-3">
			<View className="h-10 w-10 items-center justify-center rounded-full bg-system-subtle">
				{icon}
			</View>
			<Text
				selectable
				className="flex-1 font-poppins font-semibold text-body-2 text-text"
			>
				{children}
			</Text>
		</View>
	);
}

export function TheoryTopicPage({
	item,
	currentIndex,
	total,
	isCompleting,
	onPrevious,
	onNext,
}: TheoryTopicPageProps) {
	const insets = useSafeAreaInsets();
	const { colors } = useDayovaTheme();
	const reduceMotion = useReducedMotion();
	const topic = adaptTheoryTopic(item, currentIndex);
	const navigation = getTheoryTopicNavigation(currentIndex, total);
	const [isSpeaking, setIsSpeaking] = useState(false);
	const [speechError, setSpeechError] = useState<string | null>(null);
	const speechRunRef = useRef(0);

	const stopSpeaking = useCallback(() => {
		speechRunRef.current += 1;
		setIsSpeaking(false);
		void Speech.stop().catch(() => undefined);
	}, []);

	useFocusEffect(useCallback(() => () => stopSpeaking(), [stopSpeaking]));

	const toggleSpeech = useCallback(() => {
		if (isSpeaking) {
			stopSpeaking();
			return;
		}

		const nextRun = speechRunRef.current + 1;
		speechRunRef.current = nextRun;
		setSpeechError(null);
		void Speech.stop()
			.then(() => {
				if (speechRunRef.current !== nextRun) return;

				const speechChunks = splitTheorySpeechText(
					buildTheorySpeechText(topic),
					Speech.maxSpeechInputLength,
				);
				const speakChunk = (chunkIndex: number) => {
					const chunk = speechChunks[chunkIndex];
					if (!chunk || speechRunRef.current !== nextRun) return;

					Speech.speak(chunk, {
						language: "de-DE",
						rate: 0.92,
						useApplicationAudioSession: false,
						onStart: () => {
							if (speechRunRef.current === nextRun) setIsSpeaking(true);
						},
						onDone: () => {
							if (speechRunRef.current !== nextRun) return;
							if (chunkIndex < speechChunks.length - 1) {
								speakChunk(chunkIndex + 1);
								return;
							}
							setIsSpeaking(false);
						},
						onStopped: () => {
							if (speechRunRef.current === nextRun) setIsSpeaking(false);
						},
						onError: () => {
							if (speechRunRef.current !== nextRun) return;
							setIsSpeaking(false);
							setSpeechError(SPEECH_ERROR_MESSAGE);
						},
					});
				};
				speakChunk(0);
			})
			.catch(() => {
				if (speechRunRef.current !== nextRun) return;
				setIsSpeaking(false);
				setSpeechError(SPEECH_ERROR_MESSAGE);
			});
	}, [isSpeaking, stopSpeaking, topic]);

	const stopAndRun = (action: () => void) => {
		stopSpeaking();
		action();
	};

	return (
		<View className="flex-1 bg-background">
			<View className="border-border border-b bg-background px-6 py-5">
				<View className="mb-3 flex-row items-center justify-between">
					<Text
						selectable
						className="font-poppins font-semibold text-body-5 text-primary"
					>
						THEMA {currentIndex + 1}
					</Text>
					<Text
						selectable
						className="font-poppins text-body-5 text-secondary-text"
						// Tabular counter alignment requires React Native's text style API.
						style={{ fontVariant: ["tabular-nums"] }}
					>
						{currentIndex + 1} von {total}
					</Text>
				</View>
				<FlowProgressBar
					progress={(currentIndex + 1) / Math.max(total, 1)}
					accessibilityRole="progressbar"
					accessibilityValue={{
						min: 1,
						max: Math.max(total, 1),
						now: currentIndex + 1,
						text: `Thema ${currentIndex + 1} von ${total}`,
					}}
				/>
			</View>

			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={{
					paddingHorizontal: 24,
					paddingTop: 28,
					paddingBottom: 36,
				}}
				showsVerticalScrollIndicator={false}
			>
				<Animated.View
					key={item.id}
					entering={reduceMotion ? undefined : FadeInDown.duration(220)}
					className="gap-7"
				>
					<View className="gap-4">
						<View className="flex-row items-start gap-4">
							<Text
								selectable
								accessibilityRole="header"
								className="flex-1 font-poppins font-semibold text-heading-2 text-text"
							>
								{topic.conceptTitle}
							</Text>
							<TouchableOpacity
								accessibilityLabel={
									isSpeaking ? "Vorlesen stoppen" : "Thema vorlesen"
								}
								accessibilityRole="button"
								accessibilityState={{ selected: isSpeaking }}
								activeOpacity={0.8}
								hitSlop={8}
								onPress={toggleSpeech}
								className="h-12 w-12 items-center justify-center rounded-full bg-system-subtle"
							>
								{isSpeaking ? (
									<Stop
										size={21}
										color={DAYOVA_DESIGN_SYSTEM.colors.primary}
										strokeWidth={2.2}
									/>
								) : (
									<VolumeHigh
										size={22}
										color={DAYOVA_DESIGN_SYSTEM.colors.primary}
										strokeWidth={2.2}
									/>
								)}
							</TouchableOpacity>
						</View>
						<View className="rounded-[24px] bg-system-subtle px-5 py-5">
							<Text className="font-poppins font-semibold text-body-4 text-primary">
								Leitfrage
							</Text>
							<Text
								selectable
								className="mt-2 font-poppins font-semibold text-body-1 text-text"
							>
								{topic.question}
							</Text>
						</View>
						{speechError ? (
							<Text
								selectable
								accessibilityLiveRegion="polite"
								className="font-poppins text-body-4 text-wrong"
							>
								{speechError}
							</Text>
						) : null}
					</View>

					<View className="gap-4">
						<TopicSectionTitle
							icon={
								<BookOpen
									size={20}
									color={DAYOVA_DESIGN_SYSTEM.colors.primary}
									strokeWidth={2.1}
								/>
							}
						>
							Das solltest du wissen
						</TopicSectionTitle>
						<Text
							selectable
							className="font-poppins text-body-2 text-secondary-text"
						>
							{topic.explanation}
						</Text>
						{topic.keyPoints.length > 0 ? (
							<View className="gap-3">
								{topic.keyPoints.map((keyPoint) => (
									<View key={keyPoint} className="flex-row gap-3">
										<View className="mt-2 h-2 w-2 rounded-full bg-primary" />
										<Text
											selectable
											className="flex-1 font-poppins text-body-2 text-text"
										>
											{keyPoint}
										</Text>
									</View>
								))}
							</View>
						) : null}
					</View>

					{topic.example ? (
						<View className="gap-4 rounded-[32px] border border-primary/20 bg-system-subtle px-5 py-5">
							<TopicSectionTitle
								icon={
									<Pencil
										size={19}
										color={DAYOVA_DESIGN_SYSTEM.colors.primary}
										strokeWidth={2.1}
									/>
								}
							>
								Beispiel
							</TopicSectionTitle>
							<Text selectable className="font-poppins text-body-2 text-text">
								{topic.example}
							</Text>
						</View>
					) : null}

					{topic.memoryCue ? (
						<View className="gap-4 rounded-[32px] bg-theorie-subtle px-5 py-5">
							<TopicSectionTitle
								icon={
									<Bulb
										size={20}
										color={DAYOVA_DESIGN_SYSTEM.colors.theorie}
										strokeWidth={2.1}
									/>
								}
							>
								Merksatz
							</TopicSectionTitle>
							<Text selectable className="font-poppins text-body-2 text-text">
								{topic.memoryCue}
							</Text>
						</View>
					) : null}

					{topic.commonMistake ? (
						<View className="gap-4 rounded-[32px] bg-wrong-subtle px-5 py-5">
							<TopicSectionTitle
								icon={
									<CircleAlert
										size={20}
										color={DAYOVA_DESIGN_SYSTEM.colors.wrong}
										strokeWidth={2.1}
									/>
								}
							>
								Typischer Fehler
							</TopicSectionTitle>
							<Text selectable className="font-poppins text-body-2 text-text">
								{topic.commonMistake}
							</Text>
						</View>
					) : null}
				</Animated.View>
			</ScrollView>

			<View
				className="flex-row gap-3 border-border border-t bg-card px-6 pt-4"
				// Footer padding depends on the device safe area.
				style={{ paddingBottom: Math.max(insets.bottom, 16) }}
			>
				<Button
					className="flex-1 px-4"
					disabled={!navigation.canGoPrevious || isCompleting}
					onPress={() => stopAndRun(onPrevious)}
					variant="neutral"
				>
					<Text>Zurück</Text>
				</Button>
				<Button
					className="flex-[1.35] px-4"
					disabled={isCompleting}
					onPress={() => stopAndRun(onNext)}
				>
					{isCompleting ? (
						<ActivityIndicator color={colors.light1} />
					) : (
						<Text>{navigation.primaryLabel}</Text>
					)}
				</Button>
			</View>
		</View>
	);
}
