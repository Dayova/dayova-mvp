import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

const PROGRESS_RING_SIZE = 108;
const LARGE_PROGRESS_RING_SIZE = 156;
const PROGRESS_RING_STROKE_WIDTH = 9;

// borderCurve is native geometry and has no NativeWind utility.
const continuousCardStyle = { borderCurve: "continuous" } as const;

export type AnalyticsAnswerAccuracy = {
	answeredQuestions: number;
	correctAnswers: number;
	percent: number | null;
};

type RingProgress = {
	answered: number;
	correct: number;
	progressPercent: number | null;
};

function getRingProgress(accuracy: AnalyticsAnswerAccuracy): RingProgress {
	const answered = Math.max(0, accuracy.answeredQuestions);
	const correct = Math.min(Math.max(0, accuracy.correctAnswers), answered);

	return {
		answered,
		correct,
		progressPercent:
			answered > 0 && accuracy.percent !== null
				? Math.min(Math.max(Math.round(accuracy.percent), 0), 100)
				: null,
	};
}

function getProgressHeadline({
	preliminary,
	progressPercent,
}: {
	preliminary: boolean;
	progressPercent: number | null;
}) {
	if (preliminary) return "Dein Startpunkt ist sichtbar";
	if (progressPercent === null) return "Noch keine Antworten bewertet";
	if (progressPercent === 100) return "Stark – alle Antworten sind richtig";
	if (progressPercent >= 80) return "Stark – du bist auf dem richtigen Weg";
	if (progressPercent >= 50) return "Guter Anfang – bleib dran";
	if (progressPercent > 0) return "Jede richtige Antwort zählt";
	return "Jetzt kannst du gezielt besser werden";
}

function getProgressMotivation(ringProgress: RingProgress) {
	if (ringProgress.progressPercent === null) {
		return "Beantworte deine erste Frage – dann wird dein Fortschritt sichtbar.";
	}
	const questionLabel = ringProgress.answered === 1 ? "Frage" : "Fragen";
	if (ringProgress.progressPercent === 100) {
		return `${ringProgress.correct} von ${ringProgress.answered} ${questionLabel} richtig – stark, halte dieses Niveau.`;
	}
	if (ringProgress.progressPercent >= 80) {
		return `${ringProgress.correct} von ${ringProgress.answered} ${questionLabel} richtig – das ist ein starker Stand.`;
	}
	if (ringProgress.progressPercent >= 50) {
		return `${ringProgress.correct} von ${ringProgress.answered} ${questionLabel} richtig – du bist auf einem guten Weg.`;
	}
	return `${ringProgress.correct} von ${ringProgress.answered} ${questionLabel} richtig – jede weitere bringt dich voran.`;
}

function AnswerAccuracyRing({
	large,
	progress,
}: {
	large: boolean;
	progress: RingProgress;
}) {
	const { colors } = useDayovaTheme();
	const ringSize = large ? LARGE_PROGRESS_RING_SIZE : PROGRESS_RING_SIZE;
	const ringRadius = (ringSize - PROGRESS_RING_STROKE_WIDTH) / 2;
	const ringCircumference = 2 * Math.PI * ringRadius;
	const progressOffset =
		ringCircumference * (1 - (progress.progressPercent ?? 0) / 100);
	const accessibilityValue =
		progress.progressPercent === null
			? { text: "Noch keine Antworten bewertet" }
			: {
					min: 0,
					max: 100,
					now: progress.progressPercent,
					text: `${progress.progressPercent} Prozent der Antworten richtig`,
				};

	return (
		<View
			accessible
			accessibilityLabel={
				progress.progressPercent === null
					? "Noch keine Antworten bewertet"
					: `${progress.correct} von ${progress.answered} Antworten richtig`
			}
			accessibilityRole="progressbar"
			accessibilityValue={accessibilityValue}
			className="items-center justify-center"
			// Ring geometry expands at accessibility text sizes.
			style={{ width: ringSize, height: ringSize }}
			testID="analysis-progress-ring"
		>
			<View className="absolute inset-0">
				<Svg
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
					width={ringSize}
					height={ringSize}
					viewBox={`0 0 ${ringSize} ${ringSize}`}
				>
					<Circle
						cx={ringSize / 2}
						cy={ringSize / 2}
						r={ringRadius}
						fill="none"
						stroke={colors.path1}
						strokeWidth={PROGRESS_RING_STROKE_WIDTH}
					/>
					<Circle
						cx={ringSize / 2}
						cy={ringSize / 2}
						r={ringRadius}
						fill="none"
						stroke={colors.success}
						strokeDasharray={`${ringCircumference} ${ringCircumference}`}
						strokeDashoffset={progressOffset}
						strokeLinecap="round"
						strokeWidth={PROGRESS_RING_STROKE_WIDTH}
						transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
					/>
				</Svg>
			</View>
			<Text
				selectable
				className="font-poppins font-semibold text-heading-2 text-success"
				style={{ fontVariant: ["tabular-nums"] }}
			>
				{progress.progressPercent === null
					? "–"
					: `${progress.progressPercent}%`}
			</Text>
			<Text className="font-poppins text-body-5 text-secondary-text">
				{progress.progressPercent === null ? "noch offen" : "Antworten richtig"}
			</Text>
		</View>
	);
}

export function AnalyticsProgressCard({
	accuracy,
	preliminary,
}: {
	accuracy: AnalyticsAnswerAccuracy;
	preliminary: boolean;
}) {
	const { shouldStackInlineContent } = useContentSizeLayout();
	const ringProgress = getRingProgress(accuracy);

	return (
		<Surface
			className="border border-border p-5"
			style={continuousCardStyle}
			testID="analysis-progress-card"
			variant="flat"
		>
			<View
				className={cn(
					"gap-5",
					shouldStackInlineContent ? "items-start" : "flex-row items-center",
				)}
			>
				<View className="min-w-0 flex-1 gap-2">
					<Text className="font-poppins font-semibold text-body-5 text-success">
						DEIN FORTSCHRITT
					</Text>
					<Text
						selectable
						className="font-poppins font-semibold text-body-1 text-text"
					>
						{getProgressHeadline({
							preliminary,
							progressPercent: ringProgress.progressPercent,
						})}
					</Text>
					<Text
						selectable
						className="font-poppins text-body-4 text-secondary-text"
					>
						{getProgressMotivation(ringProgress)}
					</Text>
				</View>

				<View className={shouldStackInlineContent ? "self-center" : undefined}>
					<AnswerAccuracyRing
						large={shouldStackInlineContent}
						progress={ringProgress}
					/>
				</View>
			</View>
		</Surface>
	);
}
