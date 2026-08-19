import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	FlatList as NativeFlatList,
	Pressable,
	useWindowDimensions,
	View,
} from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { NotificationButton } from "~/components/notification-button";
import { AnimatedFlowerLoader } from "~/components/ui/animated-flower-loader";
import { Button } from "~/components/ui/button";
import {
	ArrowDataTransferHorizontal,
	ArrowRight,
	ArrowUpRight,
	CalendarDays,
	Check,
	CircleAlert,
	Info,
	Repeat,
	Sparkles,
	Time04,
} from "~/components/ui/icon";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { SelectSheet } from "~/components/ui/select-sheet";
import { ActionSurface, Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthSession } from "~/context/AuthContext";
import { getDayKey, useCurrentLocalDay } from "~/lib/day-key";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { ROUTES, withReturnTo } from "~/lib/routes";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";
import { AnalyticsProgressCard } from "./analytics-progress-card";

type ExamAnalysis = NonNullable<
	ReturnType<typeof useQuery<typeof api.userAnalytics.getExamAnalysis>>
>;
type ExamProblem = NonNullable<ExamAnalysis["primaryProblem"]>;
type TopicStatus = ExamAnalysis["topics"][number]["status"];
type TopicQuestionEvidence = NonNullable<
	ReturnType<typeof useQuery<typeof api.userAnalytics.getTopicQuestionEvidence>>
>;
type TopicQuestion = TopicQuestionEvidence["questions"][number];

const DIAGNOSIS_COPY: Record<
	ExamProblem["diagnosisType"],
	{ label: string; surfaceClassName: string; textClassName: string }
> = {
	knowledgeGap: {
		label: "Wissenslücke",
		surfaceClassName: "bg-wrong-subtle",
		textClassName: "text-wrong",
	},
	misconception: {
		label: "Missverständnis",
		surfaceClassName: "bg-wrong-subtle",
		textClassName: "text-wrong",
	},
	applicationError: {
		label: "Anwendungsfehler",
		surfaceClassName: "bg-info-subtle",
		textClassName: "text-info",
	},
	unclear: {
		label: "Noch unklar",
		surfaceClassName: "bg-system-subtle",
		textClassName: "text-primary-strong",
	},
};

const TOPIC_STATUS_COPY: Record<
	TopicStatus,
	{
		label: string;
		pillClassName: string;
		textClassName: string;
	}
> = {
	secure: {
		label: "Sicher belegt",
		pillClassName: "bg-success-subtle",
		textClassName: "text-success",
	},
	developing: {
		label: "Im Aufbau",
		pillClassName: "bg-info-subtle",
		textClassName: "text-info",
	},
	uncertain: {
		label: "Unsicher",
		pillClassName: "bg-wrong-subtle",
		textClassName: "text-wrong",
	},
	unknown: {
		label: "Noch nicht belegt",
		pillClassName: "bg-light-2",
		textClassName: "text-secondary-text",
	},
};

const TOPIC_CRITERION_CLASS: Record<TopicStatus, string> = {
	secure: "border-success bg-success",
	developing: "border-info bg-info",
	uncertain: "border-wrong bg-wrong",
	unknown: "border-border bg-transparent",
};

function TopicCriterionIcon({ status }: { status: TopicStatus }) {
	const iconColor = DAYOVA_DESIGN_SYSTEM.colors.buttonNeutral;

	if (status === "secure") {
		return <Check size={12} color={iconColor} strokeWidth={3} />;
	}
	if (status === "developing") {
		return <ArrowUpRight size={12} color={iconColor} strokeWidth={3} />;
	}
	if (status === "uncertain") {
		return <CircleAlert size={12} color={iconColor} strokeWidth={2.5} />;
	}
	return null;
}

const ANSWER_RATING_COPY = {
	correct: {
		label: "Richtig",
		pillClassName: "bg-success-subtle",
		textClassName: "text-success",
	},
	partiallyCorrect: {
		label: "Teilweise richtig",
		pillClassName: "bg-info-subtle",
		textClassName: "text-info",
	},
	notCorrect: {
		label: "Noch nicht richtig",
		pillClassName: "bg-wrong-subtle",
		textClassName: "text-wrong",
	},
} as const;

const SESSION_PHASE_COPY = {
	theory: "Theorie",
	practice: "Üben",
	rehearsal: "Praxis",
} as const;

const TOPIC_ANSWER_FLIP_DURATION_MS = 320;
const TOPIC_ANSWER_CARD_MIN_HEIGHT = 240;

const formatTopicAnswerReview = (review: string) => {
	const standaloneReview = review
		.replace(
			/^Noch nicht korrekt\.\s*Schau dir die perfekte Antwort an und achte auf den vollständigen Lösungsweg\.\s*/i,
			"",
		)
		.replace(
			/^Teilweise richtig\.\s*Du triffst einen Teil des Lösungswegs, solltest aber noch genauer werden\.\s*/i,
			"",
		)
		.replace(
			/Vergleiche die ideale Antwort mit der Frage und achte auf den vollständigen Gedankengang\./gi,
			"Beantworte bei der nächsten Frage die gefragte Kernaussage und begründe sie.",
		)
		.trim();
	return formatGermanUiText(standaloneReview || review);
};

const formatExamLabel = (plan: ExamAnalysis["plans"][number]) =>
	formatGermanUiText(
		`${plan.subject} · ${plan.examTypeLabel} · ${plan.examDateLabel}`,
	);

const formatRemainingDays = (days: number) => {
	if (days < 0) return "Prüfung vorbei";
	if (days === 0) return "Prüfung heute";
	if (days === 1) return "Noch 1 Tag";
	return `Noch ${days} Tage`;
};

// borderCurve is native geometry and has no NativeWind utility.
const continuousCardStyle = { borderCurve: "continuous" } as const;

function useExamAnalysisQuery(
	selectedPlanId: Id<"learningPlans"> | null | undefined,
) {
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const today = useCurrentLocalDay();
	const queryArgs = useMemo(
		() => ({
			todayKey: getDayKey(today),
			...(selectedPlanId ? { learningPlanId: selectedPlanId } : {}),
		}),
		[selectedPlanId, today],
	);

	return useQuery(
		api.userAnalytics.getExamAnalysis,
		user && isConvexAuthenticated ? queryArgs : "skip",
	);
}

function useKnowledgeHistoryQuery() {
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const today = useCurrentLocalDay();
	const queryArgs = useMemo(
		() => ({
			period: "all" as const,
			todayKey: getDayKey(today),
			timezoneOffsetMinutes: today.getTimezoneOffset(),
		}),
		[today],
	);

	return useQuery(
		api.userAnalytics.getOverview,
		user && isConvexAuthenticated ? queryArgs : "skip",
	);
}

function useTopicQuestionEvidenceQuery(
	learningPlanId: Id<"learningPlans"> | null | undefined,
	topicId: string | null | undefined,
) {
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	return useQuery(
		api.userAnalytics.getTopicQuestionEvidence,
		user && isConvexAuthenticated && learningPlanId && topicId
			? { learningPlanId, topicId }
			: "skip",
	);
}

function SectionHeading({
	title,
	description,
}: {
	title: string;
	description?: string;
}) {
	return (
		<View className="gap-1">
			<Text
				selectable
				className="font-poppins font-semibold text-body-1 text-text"
			>
				{title}
			</Text>
			{description ? (
				<Text
					selectable
					className="font-poppins text-body-4 text-secondary-text"
				>
					{description}
				</Text>
			) : null}
		</View>
	);
}

function ExamSwitcher({
	analysis,
	visible,
	onOpen,
	onClose,
	onSelect,
}: {
	analysis: ExamAnalysis;
	visible: boolean;
	onOpen: () => void;
	onClose: () => void;
	onSelect: (planId: Id<"learningPlans">) => void;
}) {
	const { colors } = useDayovaTheme();
	const selectedPlan = analysis.selectedPlan;
	if (!selectedPlan) return null;
	const selectedLabel = formatExamLabel(selectedPlan);
	const planIds = analysis.plans.map((plan) => plan.id);
	const planById = new Map(analysis.plans.map((plan) => [plan.id, plan]));

	return (
		<>
			<ActionSurface
				accessibilityHint="Öffnet die Liste deiner Prüfungen."
				accessibilityLabel={`Prüfung wechseln. Ausgewählt: ${selectedLabel}`}
				accessibilityRole="button"
				accessibilityState={{ expanded: visible }}
				className="h-14 w-14 items-center justify-center rounded-full border border-border bg-card shadow-black/5 shadow-sm active:bg-card/80"
				hitSlop={8}
				onPress={onOpen}
			>
				<ArrowDataTransferHorizontal
					size={22}
					color={colors.text}
					strokeWidth={2.2}
				/>
			</ActionSurface>
			<SelectSheet
				formatOptionLabel={(planId) => {
					const plan = planById.get(planId);
					return plan ? formatExamLabel(plan) : "Prüfung";
				}}
				onClose={onClose}
				onSelect={onSelect}
				options={planIds}
				selectedValue={selectedPlan.id}
				title="Prüfung auswählen"
				visible={visible}
			/>
		</>
	);
}

function AnalysisHub({
	analysis,
	onOpenNextStep,
	onOpenTopic,
}: {
	analysis: ExamAnalysis;
	onOpenNextStep: () => void;
	onOpenTopic: (topicId: string) => void;
}) {
	const { colors } = useDayovaTheme();
	const recommendation = analysis.recommendation;
	return (
		<View className="gap-7">
			<AnalyticsProgressCard
				accuracy={analysis.answerAccuracy}
				preliminary={analysis.preliminary}
			/>

			<View className="gap-4">
				<SectionHeading
					title="Deine Themen im Detail"
					description="Nach Prüfungsrelevanz und Lernrisiko sortiert."
				/>
				<Surface
					className="overflow-hidden border border-border"
					style={continuousCardStyle}
					testID="topic-list"
					variant="flat"
				>
					<TopicList topics={analysis.topics} onOpenTopic={onOpenTopic} />
				</Surface>
			</View>

			<ActionSurface
				accessibilityHint="Öffnet deinen empfohlenen nächsten Lernschritt."
				accessibilityLabel={`Nächster Schritt: ${
					recommendation?.goal ?? "Lernplan prüfen"
				}`}
				accessibilityRole="button"
				className="flex-row items-center gap-4 rounded-info border border-primary/20 bg-system-subtle p-4 shadow-none"
				onPress={onOpenNextStep}
				style={continuousCardStyle}
				variant="flat"
			>
				<View className="h-11 w-11 items-center justify-center rounded-full bg-card">
					<Sparkles size={21} color={colors.primaryStrong} strokeWidth={2.2} />
				</View>
				<View className="min-w-0 flex-1 gap-1">
					<Text className="font-poppins font-semibold text-body-5 text-primary-strong">
						Dein nächster Schritt
					</Text>
					<Text
						selectable
						className="font-poppins font-semibold text-body-3 text-text"
						numberOfLines={2}
					>
						{formatGermanUiText(
							recommendation?.goal ??
								"Dein Lernplan ist für diese Prüfung abgeschlossen.",
						)}
					</Text>
					<View className="flex-row items-center gap-2">
						<Time04 size={15} color={colors.primaryStrong} strokeWidth={2.2} />
						<Text
							className="font-poppins text-body-5 text-secondary-text"
							style={{ fontVariant: ["tabular-nums"] }}
						>
							{recommendation
								? `${recommendation.durationMinutes} Min.`
								: formatRemainingDays(analysis.preparation.remainingDays)}
						</Text>
					</View>
				</View>
				<ArrowRight size={19} color={colors.primaryStrong} strokeWidth={2.2} />
			</ActionSurface>
		</View>
	);
}

function ProblemCard({ problem }: { problem: ExamProblem }) {
	const diagnosis = DIAGNOSIS_COPY[problem.diagnosisType];

	return (
		<Surface className="gap-5 border border-wrong/20 p-5" variant="flat">
			<View className="gap-3">
				<View className="flex-row flex-wrap items-center gap-2">
					<View
						className={cn(
							"rounded-full px-3 py-1.5",
							diagnosis.surfaceClassName,
						)}
					>
						<Text
							className={cn(
								"font-poppins font-semibold text-body-5",
								diagnosis.textClassName,
							)}
						>
							{diagnosis.label}
						</Text>
					</View>
					<View className="rounded-full bg-background px-3 py-1.5">
						<Text className="font-poppins font-semibold text-body-5 text-secondary-text">
							{problem.evidenceLabel}
						</Text>
					</View>
				</View>
				<Text
					selectable
					className="font-poppins font-semibold text-body-1 text-text"
				>
					{problem.title}
				</Text>
				<Text
					selectable
					className="font-poppins text-body-5 text-secondary-text"
				>
					{problem.priorityReason}
				</Text>
			</View>

			<View className="gap-2 rounded-info bg-background p-4">
				<Text className="font-poppins font-semibold text-body-5 text-secondary-text">
					Beobachtet bei
				</Text>
				<Text selectable className="font-poppins text-body-3 text-text">
					{problem.location}
				</Text>
			</View>

			{problem.evidenceExcerpt ? (
				<View className="gap-2 rounded-info bg-wrong-subtle p-4">
					<Text className="font-poppins font-semibold text-body-5 text-wrong">
						Deine Antwort
					</Text>
					<Text selectable className="font-poppins text-body-3 text-wrong">
						{`„${problem.evidenceExcerpt}“`}
					</Text>
				</View>
			) : null}

			<View className="gap-4">
				<View className="gap-1">
					<Text className="font-poppins font-semibold text-body-4 text-text">
						Genau daran liegt es
					</Text>
					<Text selectable className="font-poppins text-body-3 text-text">
						{problem.observation}
					</Text>
				</View>
				<View className="gap-1">
					<Text className="font-poppins font-semibold text-body-4 text-text">
						Warum das ein Problem ist
					</Text>
					<Text selectable className="font-poppins text-body-3 text-text">
						{problem.explanation}
					</Text>
				</View>
			</View>

			<View className="gap-2 rounded-info bg-success-subtle p-4">
				<Text className="font-poppins font-semibold text-body-5 text-success">
					So wäre es korrekt
				</Text>
				<Text selectable className="font-poppins text-body-3 text-text">
					{problem.correctAnswer}
				</Text>
			</View>

			<Text selectable className="font-poppins text-body-5 text-secondary-text">
				{problem.diagnosisConfidence}
			</Text>
		</Surface>
	);
}

function ProblemSection({
	primaryProblem,
	secondaryProblems,
}: {
	primaryProblem: ExamAnalysis["primaryProblem"];
	secondaryProblems: ExamAnalysis["secondaryProblems"];
}) {
	return (
		<View className="gap-4">
			<SectionHeading
				title="Das bremst dich gerade"
				description="Dayova zeigt nur Probleme, die deine Antworten belegen."
			/>
			{primaryProblem ? (
				<ProblemCard problem={primaryProblem} />
			) : (
				<Surface className="flex-row items-start gap-3 p-5" variant="flat">
					<Info
						size={20}
						color={DAYOVA_DESIGN_SYSTEM.colors.primaryStrong}
						strokeWidth={2.2}
					/>
					<View className="min-w-0 flex-1 gap-1">
						<Text
							selectable
							className="font-poppins font-semibold text-body-3 text-text"
						>
							Noch keine klare Schwäche erkannt
						</Text>
						<Text
							selectable
							className="font-poppins text-body-4 text-secondary-text"
						>
							Ungetestete Themen bleiben als „Noch unklar“ sichtbar. Dayova
							erfindet kein Problem.
						</Text>
					</View>
				</Surface>
			)}
			{secondaryProblems.length > 0 ? (
				<View className="gap-3 pt-1">
					<Text className="font-poppins font-semibold text-body-3 text-text">
						Weitere offene Punkte
					</Text>
					{secondaryProblems.map((problem) => (
						<ProblemCard key={problem.id} problem={problem} />
					))}
				</View>
			) : null}
		</View>
	);
}

function RecommendationSection({
	analysis,
	onOpenSession,
	onOpenPlan,
}: {
	analysis: ExamAnalysis;
	onOpenSession: (sessionId: Id<"learningPlanSessions">) => void;
	onOpenPlan: () => void;
}) {
	const recommendation = analysis.recommendation;

	return (
		<View className="gap-4">
			<SectionHeading
				title="Dein nächster Lernschritt"
				description="Aus deinem aktuellen Stand und der Zeit bis zur Prüfung."
			/>
			{recommendation ? (
				<Surface className="gap-5 p-5">
					<View className="flex-row items-start gap-3">
						<View className="h-10 w-10 items-center justify-center rounded-full bg-system-subtle">
							<Sparkles
								size={20}
								color={DAYOVA_DESIGN_SYSTEM.colors.primaryStrong}
								strokeWidth={2.2}
							/>
						</View>
						<View className="min-w-0 flex-1 gap-1">
							<Text
								selectable
								className="font-poppins font-semibold text-body-1 text-text"
							>
								{formatGermanUiText(recommendation.goal)}
							</Text>
							{recommendation.reason ? (
								<Text
									selectable
									className="font-poppins text-body-4 text-secondary-text"
								>
									{recommendation.reason}
								</Text>
							) : null}
						</View>
					</View>

					<View className="gap-3">
						{recommendation.methods.map((method) => (
							<View key={method} className="flex-row items-start gap-3">
								<Check
									size={17}
									color={DAYOVA_DESIGN_SYSTEM.colors.primaryStrong}
									strokeWidth={2.3}
								/>
								<Text
									selectable
									className="min-w-0 flex-1 font-poppins text-body-3 text-text"
								>
									{formatGermanUiText(method)}
								</Text>
							</View>
						))}
					</View>

					<View className="rounded-info bg-system-subtle p-4">
						<Text className="font-poppins font-semibold text-body-5 text-primary-strong">
							Danach prüfen wir
						</Text>
						<Text
							selectable
							className="mt-1 font-poppins text-body-4 text-text"
						>
							{formatGermanUiText(recommendation.verification)}
						</Text>
					</View>

					<Button
						accessibilityLabel={`${recommendation.durationMinutes} Minuten starten`}
						onPress={() => onOpenSession(recommendation.sessionId)}
					>
						<Text>{`${recommendation.durationMinutes} Min. starten`}</Text>
						<ArrowUpRight
							size={20}
							color={DAYOVA_DESIGN_SYSTEM.colors.light1}
							strokeWidth={2.1}
						/>
					</Button>
				</Surface>
			) : (
				<Surface className="gap-4 p-5" variant="flat">
					<Text
						selectable
						className="font-poppins font-semibold text-body-3 text-text"
					>
						Die geplanten Themen sind bearbeitet
					</Text>
					<Text
						selectable
						className="font-poppins text-body-4 text-secondary-text"
					>
						Öffne deinen Lernplan, um die Prüfungsvorbereitung zu prüfen.
					</Text>
					<Button variant="neutral" onPress={onOpenPlan}>
						<Text>Lernplan ansehen</Text>
					</Button>
				</Surface>
			)}
		</View>
	);
}

function TopicStatusPill({ status }: { status: TopicStatus }) {
	const copy = TOPIC_STATUS_COPY[status];

	return (
		<View className={cn("rounded-full px-3 py-1.5", copy.pillClassName)}>
			<Text
				selectable
				className={cn(
					"font-poppins font-semibold text-body-5",
					copy.textClassName,
				)}
				numberOfLines={1}
			>
				{copy.label}
			</Text>
		</View>
	);
}

function TopicList({
	onOpenTopic,
	topics,
}: {
	onOpenTopic: (topicId: string) => void;
	topics: ExamAnalysis["topics"];
}) {
	const { colors } = useDayovaTheme();

	return topics.map((topic, index) => {
		const status = TOPIC_STATUS_COPY[topic.status];
		const requiredDimensions = topic.dimensions.filter(
			(dimension) => dimension.required,
		);
		const secureDimensionCount = requiredDimensions.filter(
			(dimension) => dimension.status === "secure",
		).length;
		const answerCountLabel =
			topic.answeredQuestionCount === 0
				? "Keine Antworten"
				: `${topic.answeredQuestionCount} ${topic.answeredQuestionCount === 1 ? "Antwort" : "Antworten"}`;
		return (
			<ActionSurface
				key={topic.id}
				accessibilityHint="Öffnet deinen Wissensstand und alle ausgewerteten Antworten für dieses Thema."
				accessibilityLabel={`${topic.title}. ${status.label}. ${topic.answeredQuestionCount} ${topic.answeredQuestionCount === 1 ? "ausgewertete Antwort" : "ausgewertete Antworten"}. ${secureDimensionCount} von ${requiredDimensions.length} Lernkriterien sicher belegt.`}
				accessibilityRole="button"
				className={cn(
					"min-h-20 gap-2 rounded-none bg-card px-5 py-4",
					index > 0 && "border-border border-t",
				)}
				onPress={() => onOpenTopic(topic.id)}
				testID={`topic-row-${topic.id}`}
				variant="flat"
			>
				<View className="flex-row items-start gap-3">
					<Text
						selectable
						className="min-w-0 flex-1 font-poppins font-semibold text-body-3 text-text"
					>
						{formatGermanUiText(topic.title)}
					</Text>
					<ArrowRight
						size={18}
						color={colors.secondaryText}
						strokeWidth={2.2}
					/>
				</View>
				<View className="flex-row flex-wrap items-center">
					<Text
						selectable
						className="font-poppins text-body-5 text-secondary-text"
					>
						{answerCountLabel}
					</Text>
				</View>
				{requiredDimensions.length > 0 ? (
					<View className="flex-row items-center gap-3">
						<View
							accessibilityElementsHidden
							importantForAccessibility="no-hide-descendants"
							className="flex-row gap-2"
						>
							{requiredDimensions.map((dimension) => (
								<View
									key={dimension.kind}
									className={cn(
										"h-5 w-5 items-center justify-center rounded-full border-2",
										TOPIC_CRITERION_CLASS[dimension.status],
									)}
									testID={`topic-criterion-${topic.id}-${dimension.kind}`}
								>
									<TopicCriterionIcon status={dimension.status} />
								</View>
							))}
						</View>
						<Text
							selectable
							className="min-w-0 flex-1 font-poppins text-body-5 text-secondary-text"
						>
							{`${secureDimensionCount} von ${requiredDimensions.length} Lernkriterien sicher`}
						</Text>
					</View>
				) : null}
			</ActionSurface>
		);
	});
}

function TopicAnswerCardHeader({ question }: { question: TopicQuestion }) {
	const rating = ANSWER_RATING_COPY[question.rating];

	return (
		<View className="flex-row items-center justify-between gap-3">
			<Text
				selectable
				className="min-w-0 flex-1 font-poppins text-body-5 text-secondary-text"
				numberOfLines={2}
			>
				{`${SESSION_PHASE_COPY[question.phase]} · ${formatGermanUiText(question.sessionTitle)}`}
			</Text>
			<View className={cn("rounded-full px-3 py-1.5", rating.pillClassName)}>
				<Text
					className={cn(
						"font-poppins font-semibold text-body-5",
						rating.textClassName,
					)}
				>
					{rating.label}
				</Text>
			</View>
		</View>
	);
}

function TopicAnswerFlipHint({ label }: { label: string }) {
	const { colors } = useDayovaTheme();

	return (
		<View className="flex-row items-center justify-end gap-2 border-border border-t pt-4">
			<Repeat size={15} color={colors.primaryStrong} strokeWidth={2.2} />
			<Text className="font-poppins font-semibold text-body-5 text-primary-strong">
				{label}
			</Text>
		</View>
	);
}

function TopicAnswerFlipCard({
	cardWidth,
	question,
}: {
	cardWidth: number;
	question: TopicQuestion;
}) {
	const [isFlipped, setIsFlipped] = useState(false);
	const [frontHeight, setFrontHeight] = useState(0);
	const [backHeight, setBackHeight] = useState(0);
	const rotation = useSharedValue(0);
	const reduceMotion = useReducedMotion();
	const formattedPrompt = formatGermanUiText(question.prompt);
	const formattedAnswer = formatGermanUiText(question.answer);
	const formattedReview = formatTopicAnswerReview(question.review);
	const rating = ANSWER_RATING_COPY[question.rating];
	const hasMeasuredFaces = frontHeight > 0 && backHeight > 0;
	const cardHeight = Math.max(
		frontHeight,
		backHeight,
		TOPIC_ANSWER_CARD_MIN_HEIGHT,
	);
	const frontAnimatedStyle = useAnimatedStyle(() => {
		const angle = rotation.get();
		return {
			backfaceVisibility: "hidden",
			opacity: angle < 90 ? 1 : 0,
			transform: [{ perspective: 1_000 }, { rotateY: `${angle}deg` }],
			zIndex: angle < 90 ? 1 : 0,
		};
	});
	const backAnimatedStyle = useAnimatedStyle(() => {
		const angle = rotation.get();
		return {
			backfaceVisibility: "hidden",
			opacity: angle >= 90 ? 1 : 0,
			transform: [{ perspective: 1_000 }, { rotateY: `${angle + 180}deg` }],
			zIndex: angle >= 90 ? 1 : 0,
		};
	});

	const flipCard = () => {
		const nextFlipped = !isFlipped;
		setIsFlipped(nextFlipped);
		const targetRotation = nextFlipped ? 180 : 0;
		rotation.set(
			reduceMotion
				? targetRotation
				: withTiming(targetRotation, {
						duration: TOPIC_ANSWER_FLIP_DURATION_MS,
						easing: Easing.inOut(Easing.cubic),
					}),
		);
	};

	return (
		<Pressable
			accessible
			accessibilityHint={
				isFlipped
					? "Zeigt wieder die Frage."
					: "Zeigt deine letzte Antwort und ihre Auswertung."
			}
			accessibilityLabel={
				isFlipped
					? `Deine Antwort: ${formattedAnswer} Auswertung: ${formattedReview} Frage anzeigen.`
					: `Frage: ${formattedPrompt} ${rating.label}. Antwort und Auswertung anzeigen.`
			}
			accessibilityRole="button"
			accessibilityState={{ expanded: isFlipped }}
			className="relative active:opacity-90"
			onPress={flipCard}
			testID={`topic-answer-card-${question.itemId}`}
			// Width and height depend on the current device and measured face content.
			style={{ width: cardWidth, height: cardHeight }}
		>
			<Animated.View
				accessibilityElementsHidden={isFlipped}
				importantForAccessibility={isFlipped ? "no-hide-descendants" : "auto"}
				pointerEvents="none"
				className={cn("absolute inset-x-0 top-0", hasMeasuredFaces && "h-full")}
				onLayout={({ nativeEvent }) =>
					setFrontHeight(nativeEvent.layout.height)
				}
				style={frontAnimatedStyle}
				testID={`topic-answer-card-front-${question.itemId}`}
			>
				<Surface
					className={cn(
						"justify-between gap-5 border border-border bg-card p-5",
						hasMeasuredFaces && "h-full",
					)}
					variant="soft"
				>
					<View className="gap-5">
						<TopicAnswerCardHeader question={question} />
						<View className="gap-2">
							<Text className="font-poppins font-semibold text-body-5 text-primary-strong">
								FRAGE
							</Text>
							<Text
								selectable
								className="font-poppins font-semibold text-body-1 text-text"
							>
								{formattedPrompt}
							</Text>
						</View>
					</View>
					<TopicAnswerFlipHint label="Antwort ansehen" />
				</Surface>
			</Animated.View>

			<Animated.View
				accessibilityElementsHidden={!isFlipped}
				importantForAccessibility={isFlipped ? "auto" : "no-hide-descendants"}
				pointerEvents="none"
				className={cn("absolute inset-x-0 top-0", hasMeasuredFaces && "h-full")}
				onLayout={({ nativeEvent }) => setBackHeight(nativeEvent.layout.height)}
				style={backAnimatedStyle}
				testID={`topic-answer-card-back-${question.itemId}`}
			>
				<Surface
					className={cn(
						"justify-between gap-5 border border-border bg-card p-5",
						hasMeasuredFaces && "h-full",
					)}
					variant="soft"
				>
					<View className="gap-4">
						<TopicAnswerCardHeader question={question} />
						<View className="gap-2 rounded-info bg-background p-4">
							<Text className="font-poppins font-semibold text-body-5 text-secondary-text">
								DEINE ANTWORT
							</Text>
							<Text selectable className="font-poppins text-body-3 text-text">
								{formattedAnswer}
							</Text>
						</View>
						<View className="gap-2 border-border border-t pt-4">
							<Text className="font-poppins font-semibold text-body-5 text-primary-strong">
								AUSWERTUNG
							</Text>
							<Text selectable className="font-poppins text-body-3 text-text">
								{formattedReview}
							</Text>
						</View>
					</View>
					<TopicAnswerFlipHint label="Frage ansehen" />
				</Surface>
			</Animated.View>
		</Pressable>
	);
}

function TopicQuestionEvidenceSection({
	evidence,
}: {
	evidence: TopicQuestionEvidence | undefined;
}) {
	const { width } = useWindowDimensions();
	const pagerWidth = Math.max(width - 48, 0);
	const cardWidth = Math.max(pagerWidth - 24, 240);
	const snapInterval = cardWidth + 12;
	const questionCount = evidence?.questions.length ?? 0;

	return (
		<View className="gap-3">
			<SectionHeading title="Deine Antworten" />
			{evidence === undefined ? (
				<Surface className="items-center gap-3 border border-border p-6">
					<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.primary} />
					<Text className="font-poppins text-body-4 text-secondary-text">
						Antworten werden geladen …
					</Text>
				</Surface>
			) : evidence.questions.length === 0 ? (
				<Surface className="gap-2 border border-border p-5">
					<Text className="font-poppins font-semibold text-body-3 text-text">
						Noch keine ausgewertete Antwort
					</Text>
					<Text
						selectable
						className="font-poppins text-body-4 text-secondary-text"
					>
						Sobald du eine Lernsession zu diesem Thema abschließt, erscheint die
						Auswertung hier.
					</Text>
				</Surface>
			) : (
				<View className="gap-3">
					<NativeFlatList
						accessibilityHint="Enthält horizontal angeordnete Antwortkarten."
						data={evidence.questions}
						keyExtractor={(question) => question.itemId}
						horizontal
						bounces={false}
						decelerationRate="fast"
						disableIntervalMomentum
						removeClippedSubviews={false}
						scrollEnabled={questionCount > 1}
						showsHorizontalScrollIndicator={false}
						snapToAlignment="start"
						snapToInterval={snapInterval}
						testID="topic-answer-pager"
						ItemSeparatorComponent={() => <View className="w-3" />}
						ListFooterComponent={<View className="w-6" />}
						getItemLayout={(_, index) => ({
							index,
							length: snapInterval,
							offset: snapInterval * index,
						})}
						renderItem={({ item: question }) => (
							<TopicAnswerFlipCard cardWidth={cardWidth} question={question} />
						)}
					/>
					{evidence.historyLimited ? (
						<Text
							selectable
							className="px-1 font-poppins text-body-5 text-secondary-text"
						>
							Die Ansicht zeigt die zuletzt gespeicherten Fragen zu diesem
							Thema.
						</Text>
					) : null}
				</View>
			)}
		</View>
	);
}

function TopicDetailCard({
	continueGoal,
	continueLabel,
	onContinue,
	topic,
	questionEvidence,
}: {
	continueGoal?: string;
	continueLabel: "Weiterlernen" | "Lernplan öffnen";
	onContinue: () => void;
	topic: ExamAnalysis["topics"][number];
	questionEvidence: TopicQuestionEvidence | undefined;
}) {
	return (
		<View className="gap-8">
			<Surface
				className="gap-4 border border-border p-5"
				testID="topic-summary-card"
				variant="flat"
			>
				<View className="flex-row items-start justify-between gap-3">
					<Text
						selectable
						className="min-w-0 flex-1 font-poppins font-semibold text-body-1 text-text"
					>
						{formatGermanUiText(topic.title)}
					</Text>
					<TopicStatusPill status={topic.status} />
				</View>
				<Text
					selectable
					className="font-poppins text-body-4 text-secondary-text"
				>
					{formatGermanUiText(topic.learningGoal)}
				</Text>

				<Button
					accessibilityHint="Öffnet deinen nächsten Lernschritt."
					accessibilityLabel={
						continueGoal
							? `${continueLabel}: ${formatGermanUiText(continueGoal)}`
							: continueLabel
					}
					onPress={onContinue}
				>
					<Text>{continueLabel}</Text>
					<ArrowUpRight
						size={20}
						color={DAYOVA_DESIGN_SYSTEM.colors.light1}
						strokeWidth={2.1}
					/>
				</Button>
			</Surface>

			<TopicQuestionEvidenceSection evidence={questionEvidence} />
		</View>
	);
}

function KnowledgeDetailContent({
	analysis,
	initialTopicId,
	onOpenPlan,
	onOpenSession,
}: {
	analysis: ExamAnalysis;
	initialTopicId?: string;
	onOpenPlan: () => void;
	onOpenSession: (sessionId: Id<"learningPlanSessions">) => void;
}) {
	const selectedTopic =
		analysis.topics.find((topic) => topic.id === initialTopicId) ??
		analysis.topics[0];
	const questionEvidence = useTopicQuestionEvidenceQuery(
		analysis.selectedPlan?.id,
		selectedTopic?.id,
	);

	if (!selectedTopic) {
		return (
			<Surface className="gap-2 p-5" variant="flat">
				<Text className="font-poppins font-semibold text-body-3 text-text">
					Noch keine Prüfungsthemen
				</Text>
				<Text
					selectable
					className="font-poppins text-body-4 text-secondary-text"
				>
					Sobald dein Lernplan Themen enthält, erscheinen hier deine Belege.
				</Text>
			</Surface>
		);
	}

	return (
		<TopicDetailCard
			continueGoal={analysis.recommendation?.goal}
			continueLabel={
				analysis.recommendation ? "Weiterlernen" : "Lernplan öffnen"
			}
			onContinue={() => {
				if (analysis.recommendation) {
					onOpenSession(analysis.recommendation.sessionId);
					return;
				}
				onOpenPlan();
			}}
			topic={selectedTopic}
			questionEvidence={questionEvidence}
		/>
	);
}

function PreparationSummary({
	analysis,
	onOpenPlan,
}: {
	analysis: ExamAnalysis;
	onOpenPlan: () => void;
}) {
	const preparation = analysis.preparation;

	return (
		<View className="gap-4">
			<SectionHeading
				title="Bis zur Prüfung"
				description="Die genaue Planung bleibt in deinem Lernplan."
			/>
			<Surface className="gap-5 p-5" variant="flat">
				<View className="flex-row gap-3">
					<View className="min-w-0 flex-1 gap-1 rounded-info bg-background p-4">
						<CalendarDays
							size={19}
							color={DAYOVA_DESIGN_SYSTEM.colors.primaryStrong}
							strokeWidth={2.2}
						/>
						<Text
							selectable
							className="font-poppins font-semibold text-body-2 text-text"
							style={{ fontVariant: ["tabular-nums"] }}
						>
							{formatRemainingDays(preparation.remainingDays)}
						</Text>
						<Text className="font-poppins text-body-5 text-secondary-text">
							bis zur Prüfung
						</Text>
					</View>
					<View className="min-w-0 flex-1 gap-1 rounded-info bg-background p-4">
						<Time04
							size={19}
							color={DAYOVA_DESIGN_SYSTEM.colors.primaryStrong}
							strokeWidth={2.2}
						/>
						<Text
							selectable
							className="font-poppins font-semibold text-body-2 text-text"
							style={{ fontVariant: ["tabular-nums"] }}
						>
							{`${preparation.remainingMinutes} Min.`}
						</Text>
						<Text className="font-poppins text-body-5 text-secondary-text">
							{`${preparation.remainingSessions} ${preparation.remainingSessions === 1 ? "Einheit" : "Einheiten"} geplant`}
						</Text>
					</View>
				</View>
				{preparation.nextSession ? (
					<View className="flex-row items-start gap-3 rounded-info bg-system-subtle p-4">
						<CalendarDays
							size={19}
							color={DAYOVA_DESIGN_SYSTEM.colors.primaryStrong}
							strokeWidth={2.2}
						/>
						<View className="min-w-0 flex-1 gap-0.5">
							<Text className="font-poppins font-semibold text-body-5 text-primary-strong">
								Nächste Einheit
							</Text>
							<Text selectable className="font-poppins text-body-4 text-text">
								{`${preparation.nextSession.dateLabel} · ${preparation.nextSession.startTime} · ${preparation.nextSession.durationMinutes} Min.`}
							</Text>
						</View>
					</View>
				) : null}
				<Button variant="neutral" onPress={onOpenPlan}>
					<Text>Lernplan ansehen</Text>
				</Button>
			</Surface>
		</View>
	);
}

function LoadingState() {
	return (
		<View
			accessibilityLabel="Prüfungsanalyse wird geladen"
			accessibilityLiveRegion="polite"
			className="items-center gap-4 py-24"
		>
			<AnimatedFlowerLoader size={104} />
			<Text className="font-poppins text-body-4 text-secondary-text">
				Deine Prüfungsanalyse wird geladen …
			</Text>
		</View>
	);
}

function EmptyState({ onCreatePlan }: { onCreatePlan: () => void }) {
	return (
		<Surface className="items-center gap-5 px-6 py-10" variant="flat">
			<View className="h-16 w-16 items-center justify-center rounded-full bg-system-subtle">
				<Sparkles
					size={30}
					color={DAYOVA_DESIGN_SYSTEM.colors.primaryStrong}
					strokeWidth={2}
				/>
			</View>
			<View className="items-center gap-2">
				<Text className="text-center font-poppins font-semibold text-body-1 text-text">
					Deine erste Prüfungsanalyse
				</Text>
				<Text
					selectable
					className="text-center font-poppins text-body-4 text-secondary-text"
				>
					Erstelle einen Lernplan. Danach zeigt Dayova, was du schon kannst, wo
					dein Problem liegt und welcher Schritt dir als Nächstes hilft.
				</Text>
			</View>
			<Button
				accessibilityLabel="Ersten Lernplan erstellen"
				onPress={onCreatePlan}
			>
				<Text>Ersten Lernplan erstellen</Text>
			</Button>
		</Surface>
	);
}

export function AnalyticsScreen({
	initialPlanId,
}: {
	initialPlanId?: Id<"learningPlans">;
}) {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { shouldStackInlineContent } = useContentSizeLayout();
	const [selectedPlanId, setSelectedPlanId] =
		useState<Id<"learningPlans"> | null>(initialPlanId ?? null);
	const [isSelectorOpen, setIsSelectorOpen] = useState(false);
	const analysis = useExamAnalysisQuery(selectedPlanId);

	const selectedPlanIdForRoute =
		analysis?.selectedPlan?.id ?? selectedPlanId ?? null;
	const selectedExamContext =
		analysis?.hasData && analysis.selectedPlan
			? formatGermanUiText(
					`${analysis.selectedPlan.subject} · ${analysis.selectedPlan.examTypeLabel}`,
				)
			: null;

	return (
		<Screen>
			<ThemedStatusBar />
			<View
				className="z-10 bg-background px-6 pb-5"
				// Safe-area padding is runtime device geometry.
				style={{ paddingTop: insets.top + 16 }}
			>
				<View
					className={cn(
						"gap-4",
						!shouldStackInlineContent &&
							"flex-row items-center justify-between",
					)}
				>
					<View
						className={cn(
							shouldStackInlineContent ? "w-full" : "min-w-0 flex-1 pr-4",
						)}
					>
						<Text
							accessibilityRole="header"
							className="font-poppins font-semibold text-heading-2 text-text"
						>
							Analyse
						</Text>
						{selectedExamContext ? (
							<Text
								selectable
								className="font-poppins text-body-4 text-secondary-text"
								numberOfLines={shouldStackInlineContent ? undefined : 1}
							>
								{selectedExamContext}
							</Text>
						) : null}
					</View>
					<View className="flex-row items-center gap-2 self-end">
						{analysis?.hasData ? (
							<ExamSwitcher
								analysis={analysis}
								onClose={() => setIsSelectorOpen(false)}
								onOpen={() => setIsSelectorOpen(true)}
								onSelect={setSelectedPlanId}
								visible={isSelectorOpen}
							/>
						) : null}
						<NotificationButton />
					</View>
				</View>
			</View>

			<ScreenScroll
				testID="analysis-scroll"
				includeTopSafeArea={false}
				topPadding={20}
				bottomPadding={150}
				horizontalPadding={24}
			>
				<View className="gap-7">
					{analysis === undefined ? (
						<LoadingState />
					) : analysis.hasData ? (
						<AnalysisHub
							analysis={analysis}
							onOpenNextStep={() => {
								if (selectedPlanIdForRoute) {
									if (analysis.recommendation) {
										router.push(
											withReturnTo(
												`/learning-plans/${selectedPlanIdForRoute}/sessions/${analysis.recommendation.sessionId}`,
												ROUTES.analytics,
											),
										);
										return;
									}
									router.push(`/learning-plans/${selectedPlanIdForRoute}`);
								}
							}}
							onOpenTopic={(topicId) => {
								if (selectedPlanIdForRoute) {
									router.push({
										pathname: ROUTES.analyticsKnowledge,
										params: { planId: selectedPlanIdForRoute, topicId },
									});
								}
							}}
						/>
					) : (
						<EmptyState
							onCreatePlan={() => router.push(ROUTES.createLearningPlan)}
						/>
					)}
				</View>
			</ScreenScroll>
		</Screen>
	);
}

export function AnalyticsHistoryScreen() {
	const router = useRouter();
	const overview = useKnowledgeHistoryQuery();

	return (
		<Screen>
			<ThemedStatusBar />
			<ScreenScroll
				contentInsetAdjustmentBehavior="automatic"
				includeTopSafeArea={false}
				topPadding={24}
				bottomPadding={72}
				horizontalPadding={24}
			>
				{overview === undefined ? (
					<LoadingState />
				) : !overview.hasData ? (
					<EmptyState
						onCreatePlan={() => router.push(ROUTES.createLearningPlan)}
					/>
				) : (
					<View className="gap-8">
						<View className="gap-2 px-1">
							<Text
								selectable
								className="font-poppins text-body-2 text-secondary-text"
							>
								Muster aus deinen bisherigen Prüfungen und Lernsessionen.
								Aktivität allein zählt hier nicht als Wissen.
							</Text>
						</View>

						<Surface className="gap-5 border border-border p-5" variant="flat">
							<View className="gap-1">
								<Text className="font-poppins font-semibold text-body-5 text-primary-strong">
									DEINE WISSENSBELEGE
								</Text>
								<Text
									selectable
									className="font-poppins font-semibold text-heading-2 text-text"
									style={{ fontVariant: ["tabular-nums"] }}
								>
									{overview.knowledge.answeredItems}
								</Text>
								<Text
									selectable
									className="font-poppins text-body-4 text-secondary-text"
								>
									{`geprüfte Antworten aus ${overview.overall.acceptedPlans} ${overview.overall.acceptedPlans === 1 ? "Prüfung" : "Prüfungen"}`}
								</Text>
							</View>
							<View className="flex-row gap-2">
								{[
									{
										label: "Sicher gezeigt",
										value: overview.knowledge.correct,
										className: "bg-success-subtle",
										textClassName: "text-success",
									},
									{
										label: "Teilweise",
										value: overview.knowledge.partiallyCorrect,
										className: "bg-info-subtle",
										textClassName: "text-info",
									},
									{
										label: "Noch offen",
										value: overview.knowledge.notCorrect,
										className: "bg-wrong-subtle",
										textClassName: "text-wrong",
									},
								].map((item) => (
									<View
										key={item.label}
										className={cn(
											"min-w-0 flex-1 gap-1 rounded-info px-2 py-4",
											item.className,
										)}
									>
										<Text
											className={cn(
												"font-poppins font-semibold text-body-1",
												item.textClassName,
											)}
											style={{ fontVariant: ["tabular-nums"] }}
										>
											{item.value}
										</Text>
										<Text className="font-poppins text-body-5 text-secondary-text">
											{item.label}
										</Text>
									</View>
								))}
							</View>
						</Surface>

						<View className="gap-4">
							<SectionHeading
								title="Bisher belegte Stärken"
								description="Fähigkeiten aus deinen gespeicherten Lernständen."
							/>
							<Surface className="gap-4 p-5" variant="flat">
								{overview.knowledge.strengths.length > 0 ? (
									overview.knowledge.strengths.map((strength) => (
										<View key={strength} className="flex-row items-start gap-3">
											<Check
												size={18}
												color={DAYOVA_DESIGN_SYSTEM.colors.success}
												strokeWidth={2.3}
											/>
											<Text
												selectable
												className="min-w-0 flex-1 font-poppins text-body-3 text-text"
											>
												{strength}
											</Text>
										</View>
									))
								) : (
									<Text
										selectable
										className="font-poppins text-body-4 text-secondary-text"
									>
										Noch nicht genug wiederholte Belege.
									</Text>
								)}
							</Surface>
						</View>

						<View className="gap-4">
							<SectionHeading
								title="Bisher beobachtete Lernhürden"
								description="Nur Hinweise aus deinen gespeicherten Analysen."
							/>
							<Surface
								className="gap-4 border border-wrong/20 p-5"
								variant="flat"
							>
								{overview.knowledge.gaps.length > 0 ? (
									overview.knowledge.gaps.map((gap) => (
										<View key={gap} className="flex-row items-start gap-3">
											<CircleAlert
												size={18}
												color={DAYOVA_DESIGN_SYSTEM.colors.wrong}
												strokeWidth={2.2}
											/>
											<Text
												selectable
												className="min-w-0 flex-1 font-poppins text-body-3 text-text"
											>
												{gap}
											</Text>
										</View>
									))
								) : (
									<Text
										selectable
										className="font-poppins text-body-4 text-secondary-text"
									>
										Noch kein wiederkehrendes Problem erkannt.
									</Text>
								)}
							</Surface>
						</View>

						{overview.historyLimited ? (
							<Text
								selectable
								className="px-1 font-poppins text-body-5 text-secondary-text"
							>
								Die Ansicht zeigt die zuletzt gespeicherten Lernbelege.
							</Text>
						) : null}
					</View>
				)}
			</ScreenScroll>
		</Screen>
	);
}

export type AnalyticsDetailSection = "knowledge" | "problem" | "nextStep";

const DETAIL_DESCRIPTION: Record<AnalyticsDetailSection, string | null> = {
	knowledge: null,
	problem:
		"Welche Antwort die Hürde zeigt und welches Missverständnis dahinterliegt.",
	nextStep:
		"Was du jetzt konkret tun solltest und wie es bis zur Prüfung in deine Zeit passt.",
};

function AnalyticsDetailContent({
	analysis,
	initialTopicId,
	onOpenPlan,
	onOpenSession,
	section,
}: {
	analysis: ExamAnalysis;
	initialTopicId?: string;
	onOpenPlan: () => void;
	onOpenSession: (sessionId: Id<"learningPlanSessions">) => void;
	section: AnalyticsDetailSection;
}) {
	if (section === "knowledge") {
		return (
			<KnowledgeDetailContent
				analysis={analysis}
				initialTopicId={initialTopicId}
				onOpenPlan={onOpenPlan}
				onOpenSession={onOpenSession}
			/>
		);
	}

	if (section === "problem") {
		return (
			<ProblemSection
				primaryProblem={analysis.primaryProblem}
				secondaryProblems={analysis.secondaryProblems}
			/>
		);
	}

	return (
		<View className="gap-9">
			<RecommendationSection
				analysis={analysis}
				onOpenPlan={onOpenPlan}
				onOpenSession={onOpenSession}
			/>
			<PreparationSummary analysis={analysis} onOpenPlan={onOpenPlan} />
		</View>
	);
}

export function AnalyticsDetailScreen({
	planId,
	section,
	topicId,
}: {
	planId?: Id<"learningPlans">;
	section: AnalyticsDetailSection;
	topicId?: string;
}) {
	const router = useRouter();
	const analysis = useExamAnalysisQuery(planId);
	const selectedPlanIdForRoute = analysis?.selectedPlan?.id ?? planId ?? null;
	const selectedExamContext =
		analysis?.hasData && analysis.selectedPlan
			? formatGermanUiText(
					`${analysis.selectedPlan.subject}-${analysis.selectedPlan.examTypeLabel}`,
				)
			: null;

	return (
		<Screen>
			<ThemedStatusBar />
			<ScreenScroll
				contentInsetAdjustmentBehavior="automatic"
				includeTopSafeArea={false}
				topPadding={24}
				bottomPadding={72}
				horizontalPadding={24}
			>
				{analysis === undefined ? (
					<LoadingState />
				) : analysis.hasData ? (
					<View className="gap-8">
						<View className="gap-2 px-1">
							{selectedExamContext ? (
								<Text
									selectable
									className="font-poppins font-semibold text-body-2 text-text"
								>
									{selectedExamContext}
								</Text>
							) : null}
							{DETAIL_DESCRIPTION[section] ? (
								<Text
									selectable
									className="font-poppins text-body-2 text-secondary-text"
								>
									{DETAIL_DESCRIPTION[section]}
								</Text>
							) : null}
						</View>
						<AnalyticsDetailContent
							analysis={analysis}
							initialTopicId={topicId}
							onOpenPlan={() => {
								if (selectedPlanIdForRoute) {
									router.push(`/learning-plans/${selectedPlanIdForRoute}`);
								}
							}}
							onOpenSession={(sessionId) => {
								if (selectedPlanIdForRoute) {
									router.push(
										`/learning-plans/${selectedPlanIdForRoute}/sessions/${sessionId}`,
									);
								}
							}}
							section={section}
						/>
					</View>
				) : (
					<EmptyState
						onCreatePlan={() => router.push(ROUTES.createLearningPlan)}
					/>
				)}
			</ScreenScroll>
		</Screen>
	);
}
