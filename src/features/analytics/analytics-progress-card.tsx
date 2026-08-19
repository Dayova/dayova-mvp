import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Sparkles } from "~/components/ui/icon";
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

export type AnalyticsProgress = {
	assessedCriteria: number;
	secureCriteria: number;
	secureTopics: number;
	totalCriteria: number;
	totalTopics: number;
};

type RingProgress = {
	completed: number;
	progressPercent: number | null;
	total: number;
	unit: "Lernkriterien" | "Prüfungsthemen";
};

function getRingProgress(progress: AnalyticsProgress): RingProgress {
	const usesCriteria = progress.totalCriteria > 0;
	const safeTotal = Math.max(
		0,
		usesCriteria ? progress.totalCriteria : progress.totalTopics,
	);
	const safeCompleted = Math.min(
		Math.max(0, usesCriteria ? progress.secureCriteria : progress.secureTopics),
		safeTotal,
	);

	return {
		completed: safeCompleted,
		progressPercent:
			progress.assessedCriteria > 0 && safeTotal > 0
				? Math.round((safeCompleted / safeTotal) * 100)
				: null,
		total: safeTotal,
		unit: usesCriteria ? "Lernkriterien" : "Prüfungsthemen",
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
	if (progressPercent === null) return "Noch kein Lernstand belegt";
	if (progressPercent === 100) return "Stark – du hast alles sicher belegt";
	if (progressPercent >= 50) return "Guter Fortschritt – bleib dran";
	if (progressPercent > 0) return "Dein Fortschritt nimmt Form an";
	return "Dein Lernstand wird jetzt sichtbar";
}

function getProgressDescription({
	secureTopics,
	totalTopics,
}: AnalyticsProgress) {
	if (totalTopics === 0) return "Noch keine Prüfungsthemen bewertet.";
	if (secureTopics === 1 && totalTopics === 1) {
		return "Dein Prüfungsthema ist sicher belegt.";
	}
	if (secureTopics === 1) {
		return `1 von ${totalTopics} Prüfungsthemen ist sicher belegt.`;
	}
	return `${secureTopics} von ${totalTopics} Prüfungsthemen sind sicher belegt.`;
}

function getProgressInsight({
	latestKnowledgeChange,
	progress,
}: {
	latestKnowledgeChange: string | null;
	progress: AnalyticsProgress;
}) {
	if (latestKnowledgeChange) return latestKnowledgeChange;
	if (progress.totalTopics === 0) {
		return "Öffne deinen Lernplan und ergänze zuerst die Prüfungsthemen.";
	}

	const remainingTopics = Math.max(
		progress.totalTopics - progress.secureTopics,
		0,
	);
	if (remainingTopics === 0) {
		return "Alle Themen sind sicher belegt. Wiederhole sie bis zur Prüfung.";
	}
	if (remainingTopics === 1) {
		return "Noch 1 Thema braucht weitere sichere Belege.";
	}
	return `Noch ${remainingTopics} Themen brauchen weitere sichere Belege.`;
}

function TopicProgressRing({
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
			? { text: `Noch keine ${progress.unit} bewertet` }
			: {
					min: 0,
					max: 100,
					now: progress.progressPercent,
					text: `${progress.progressPercent} Prozent der ${progress.unit} sicher belegt`,
				};

	return (
		<View
			accessible
			accessibilityLabel={
				progress.progressPercent === null
					? `Noch keine ${progress.unit} bewertet`
					: `${progress.completed} von ${progress.total} ${progress.unit} sicher belegt`
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
				{progress.progressPercent === null ? "noch offen" : "Kriterien sicher"}
			</Text>
		</View>
	);
}

export function AnalyticsProgressCard({
	latestKnowledgeChange,
	preliminary,
	progress,
}: {
	latestKnowledgeChange: string | null;
	preliminary: boolean;
	progress: AnalyticsProgress;
}) {
	const { colors } = useDayovaTheme();
	const { shouldStackInlineContent } = useContentSizeLayout();
	const ringProgress = getRingProgress(progress);

	return (
		<Surface
			className="gap-3 border border-border p-2"
			style={continuousCardStyle}
			testID="analysis-progress-card"
			variant="flat"
		>
			<View
				className={cn(
					"gap-5 px-3 pt-3",
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
						{getProgressDescription(progress)}
					</Text>
				</View>

				<View className={shouldStackInlineContent ? "self-center" : undefined}>
					<TopicProgressRing
						large={shouldStackInlineContent}
						progress={ringProgress}
					/>
				</View>
			</View>

			<View className="flex-row items-start gap-3 rounded-lg bg-system-subtle p-4">
				<Sparkles size={19} color={colors.primaryStrong} strokeWidth={2.2} />
				<Text
					selectable
					className="min-w-0 flex-1 font-poppins text-body-4 text-text"
				>
					{getProgressInsight({ latestKnowledgeChange, progress })}
				</Text>
			</View>
		</Surface>
	);
}
