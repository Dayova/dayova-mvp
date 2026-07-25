import { ActivityIndicator, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { Button } from "~/components/ui/button";
import { Check, Timer } from "~/components/ui/icon";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";

const SCORE_RING_SIZE = 176;
const SCORE_RING_STROKE_WIDTH = 14;
const SCORE_RING_RADIUS = (SCORE_RING_SIZE - SCORE_RING_STROKE_WIDTH) / 2;
const SCORE_RING_CIRCUMFERENCE = 2 * Math.PI * SCORE_RING_RADIUS;

function getScorePresentation(resultPercent: number) {
	if (resultPercent >= 80) {
		return {
			accent: DAYOVA_DESIGN_SYSTEM.colors.success,
			accentBackgroundClassName: "bg-success-subtle",
			label: "Starke Leistung!",
			description:
				"Das sitzt schon richtig gut. Schau dir deine Analyse an und festige die letzten Details.",
		};
	}

	if (resultPercent >= 60) {
		return {
			accent: DAYOVA_DESIGN_SYSTEM.colors.info,
			accentBackgroundClassName: "bg-info-subtle",
			label: "Gute Grundlage",
			description:
				"Du bist auf dem richtigen Weg. Die Analyse zeigt dir, welche Themen du noch festigen kannst.",
		};
	}

	return {
		accent: DAYOVA_DESIGN_SYSTEM.colors.wrong,
		accentBackgroundClassName: "bg-wrong-subtle",
		label: "Da geht noch mehr",
		description:
			"Das ist dein Startpunkt. Finde in der Analyse deine Lücken und verbessere dich beim nächsten Versuch.",
	};
}

function ScoreRing({
	correctCount,
	attemptCount,
}: {
	correctCount: number;
	attemptCount: number;
}) {
	const { colors } = useDayovaTheme();
	const resultPercent =
		attemptCount > 0 ? Math.round((correctCount / attemptCount) * 100) : 0;
	const presentation = getScorePresentation(resultPercent);
	const progressOffset = SCORE_RING_CIRCUMFERENCE * (1 - resultPercent / 100);

	return (
		<View
			accessible
			accessibilityLabel={`${resultPercent} Prozent richtig. ${correctCount} von ${attemptCount} Aufgaben richtig.`}
			className="items-center"
		>
			<View
				className="items-center justify-center"
				style={{ width: SCORE_RING_SIZE, height: SCORE_RING_SIZE }}
			>
				<Svg
					width={SCORE_RING_SIZE}
					height={SCORE_RING_SIZE}
					viewBox={`0 0 ${SCORE_RING_SIZE} ${SCORE_RING_SIZE}`}
					style={{ position: "absolute" }}
				>
					<Circle
						cx={SCORE_RING_SIZE / 2}
						cy={SCORE_RING_SIZE / 2}
						r={SCORE_RING_RADIUS}
						fill="none"
						stroke={colors.border}
						strokeWidth={SCORE_RING_STROKE_WIDTH}
					/>
					<Circle
						cx={SCORE_RING_SIZE / 2}
						cy={SCORE_RING_SIZE / 2}
						r={SCORE_RING_RADIUS}
						fill="none"
						stroke={presentation.accent}
						strokeDasharray={`${SCORE_RING_CIRCUMFERENCE} ${SCORE_RING_CIRCUMFERENCE}`}
						strokeDashoffset={progressOffset}
						strokeLinecap="round"
						strokeWidth={SCORE_RING_STROKE_WIDTH}
						transform={`rotate(-90 ${SCORE_RING_SIZE / 2} ${SCORE_RING_SIZE / 2})`}
					/>
				</Svg>
				<View className="items-center">
					<Text
						selectable
						className="font-poppins font-semibold text-[44px] text-text leading-[52px]"
						style={{ fontVariant: ["tabular-nums"] }}
					>
						{resultPercent}%
					</Text>
					<Text className="font-poppins font-semibold text-body-4 text-secondary-text">
						richtig
					</Text>
				</View>
			</View>
			<View
				className={`mt-4 rounded-full px-4 py-2 ${presentation.accentBackgroundClassName}`}
			>
				<Text
					className="font-poppins font-semibold text-body-4"
					style={{ color: presentation.accent }}
				>
					{presentation.label}
				</Text>
			</View>
		</View>
	);
}

export function PracticeCompletionCard({
	durationMinutes,
	correctCount,
	attemptCount,
	onRepeat,
	onAnalysis,
	isBusy,
}: {
	durationMinutes: number;
	correctCount: number;
	attemptCount: number;
	onRepeat: () => void;
	onAnalysis: () => void;
	isBusy: boolean;
}) {
	const resultPercent =
		attemptCount > 0 ? Math.round((correctCount / attemptCount) * 100) : 0;
	const presentation = getScorePresentation(resultPercent);
	const displayedDuration = Math.min(Math.max(durationMinutes, 10), 30);

	return (
		<Animated.View
			entering={FadeIn.duration(300)}
			className="flex-1 justify-center py-8"
		>
			<Surface className="rounded-[32px] px-6 py-8" variant="flat">
				<View className="items-center">
					<View className="mb-5 flex-row items-center gap-2 rounded-full bg-praxis-subtle px-4 py-2">
						<Check
							size={16}
							color={DAYOVA_DESIGN_SYSTEM.colors.praxis}
							strokeWidth={2.5}
						/>
						<Text className="font-poppins font-semibold text-body-4 text-praxis">
							Praxis beendet
						</Text>
					</View>

					<ScoreRing correctCount={correctCount} attemptCount={attemptCount} />

					<Text className="mt-5 text-center font-poppins font-semibold text-heading-2 text-text">
						{correctCount} von {attemptCount} Aufgaben richtig
					</Text>
					<Text className="mt-2 text-center font-poppins text-body-3 text-secondary-text">
						{presentation.description}
					</Text>

					<View className="mt-6 w-full flex-row gap-3">
						<View className="flex-1 items-center rounded-[24px] bg-background px-3 py-4">
							<Timer
								size={20}
								color={DAYOVA_DESIGN_SYSTEM.colors.praxis}
								strokeWidth={2.2}
							/>
							<Text className="mt-2 font-poppins font-semibold text-body-3 text-text">
								{displayedDuration} Min.
							</Text>
							<Text className="font-poppins text-body-4 text-secondary-text">
								Lernzeit
							</Text>
						</View>
						<View className="flex-1 items-center rounded-[24px] bg-background px-3 py-4">
							<View className="h-5 items-center justify-center">
								<Text
									className="font-poppins font-semibold text-body-3 text-praxis"
									style={{ fontVariant: ["tabular-nums"] }}
								>
									{attemptCount}
								</Text>
							</View>
							<Text className="mt-2 font-poppins font-semibold text-body-3 text-text">
								Aufgaben
							</Text>
							<Text className="font-poppins text-body-4 text-secondary-text">
								bearbeitet
							</Text>
						</View>
					</View>
				</View>

				<Button className="mt-7 w-full" disabled={isBusy} onPress={onAnalysis}>
					{isBusy ? (
						<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.light1} />
					) : (
						<Text>Analyse ansehen</Text>
					)}
				</Button>
				<Button
					className="mt-3 w-full"
					disabled={isBusy}
					variant="neutral"
					onPress={onRepeat}
				>
					<Text>Nochmal üben</Text>
				</Button>
			</Surface>
		</Animated.View>
	);
}
