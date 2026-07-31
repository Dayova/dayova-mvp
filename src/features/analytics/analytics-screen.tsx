import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
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
	Sparkles,
	Time04,
} from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { SelectSheet } from "~/components/ui/select-sheet";
import { ActionSurface, Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthSession } from "~/context/AuthContext";
import { getDayKey, useCurrentLocalDay } from "~/lib/day-key";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { ROUTES } from "~/lib/routes";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

type ExamAnalysis = NonNullable<
	ReturnType<typeof useQuery<typeof api.userAnalytics.getExamAnalysis>>
>;
type ExamProblem = NonNullable<ExamAnalysis["primaryProblem"]>;
type TopicStatus = ExamAnalysis["topics"][number]["status"];

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
		dotClassName: string;
		pillClassName: string;
		textClassName: string;
	}
> = {
	secure: {
		label: "Sicher",
		dotClassName: "bg-success",
		pillClassName: "bg-success-subtle",
		textClassName: "text-success",
	},
	developing: {
		label: "In Arbeit",
		dotClassName: "bg-info",
		pillClassName: "bg-info-subtle",
		textClassName: "text-info",
	},
	unknown: {
		label: "Noch unklar",
		dotClassName: "bg-primary",
		pillClassName: "bg-system-subtle",
		textClassName: "text-primary-strong",
	},
};

const PRIORITY_COPY = {
	high: "Hohe Prüfungsrelevanz",
	medium: "Mittlere Prüfungsrelevanz",
	low: "Ergänzendes Thema",
} as const;

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

const KNOWLEDGE_RING_SIZE = 112;
const KNOWLEDGE_RING_STROKE_WIDTH = 10;
const KNOWLEDGE_RING_RADIUS =
	(KNOWLEDGE_RING_SIZE - KNOWLEDGE_RING_STROKE_WIDTH) / 2;
const KNOWLEDGE_RING_CIRCUMFERENCE = 2 * Math.PI * KNOWLEDGE_RING_RADIUS;

// borderCurve is native geometry and has no NativeWind utility.
const continuousCardStyle = { borderCurve: "continuous" } as const;

function KnowledgeProgressRing({
	secureTopics,
	totalTopics,
}: {
	secureTopics: number;
	totalTopics: number;
}) {
	const { colors } = useDayovaTheme();
	const safeTotal = Math.max(0, totalTopics);
	const safeSecure = Math.min(Math.max(0, secureTopics), safeTotal);
	const hasTopics = safeTotal > 0;
	const progress = hasTopics ? safeSecure / safeTotal : 0;
	const progressOffset = KNOWLEDGE_RING_CIRCUMFERENCE * (1 - progress);

	return (
		<View accessible={false} className="h-28 w-28 items-center justify-center">
			<Svg
				pointerEvents="none"
				width={KNOWLEDGE_RING_SIZE}
				height={KNOWLEDGE_RING_SIZE}
				viewBox={`0 0 ${KNOWLEDGE_RING_SIZE} ${KNOWLEDGE_RING_SIZE}`}
				// SVG positioning is native geometry and cannot be expressed with NativeWind.
				style={{ position: "absolute" }}
			>
				<Circle
					cx={KNOWLEDGE_RING_SIZE / 2}
					cy={KNOWLEDGE_RING_SIZE / 2}
					r={KNOWLEDGE_RING_RADIUS}
					fill="none"
					stroke={colors.border}
					strokeWidth={KNOWLEDGE_RING_STROKE_WIDTH}
				/>
				{hasTopics && safeSecure > 0 ? (
					<Circle
						cx={KNOWLEDGE_RING_SIZE / 2}
						cy={KNOWLEDGE_RING_SIZE / 2}
						r={KNOWLEDGE_RING_RADIUS}
						fill="none"
						stroke={colors.success}
						strokeDasharray={`${KNOWLEDGE_RING_CIRCUMFERENCE} ${KNOWLEDGE_RING_CIRCUMFERENCE}`}
						strokeDashoffset={progressOffset}
						strokeLinecap="round"
						strokeWidth={KNOWLEDGE_RING_STROKE_WIDTH}
						transform={`rotate(-90 ${KNOWLEDGE_RING_SIZE / 2} ${KNOWLEDGE_RING_SIZE / 2})`}
					/>
				) : null}
			</Svg>
			<Text
				adjustsFontSizeToFit
				minimumFontScale={0.7}
				numberOfLines={1}
				selectable
				className="font-poppins font-semibold text-heading-2 text-text"
				style={{ fontVariant: ["tabular-nums"] }}
			>
				{hasTopics ? `${safeSecure}/${safeTotal}` : "–"}
			</Text>
		</View>
	);
}

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
	onOpenKnowledge,
	onOpenNextStep,
	onOpenProblem,
}: {
	analysis: ExamAnalysis;
	onOpenKnowledge: () => void;
	onOpenNextStep: () => void;
	onOpenProblem: () => void;
}) {
	const { colors } = useDayovaTheme();
	const recommendation = analysis.recommendation;
	const primaryProblem = analysis.primaryProblem;
	const totalTopics =
		analysis.readiness.secure +
		analysis.readiness.developing +
		analysis.readiness.unknown;
	const hasTopics = totalTopics > 0;
	const knowledgeAccessibilityLabel = hasTopics
		? `Wissensstand: ${analysis.readiness.secure} von ${totalTopics} Themen sicher belegt. Details öffnen`
		: "Wissensstand: Noch keine Prüfungsthemen bewertet. Details öffnen";

	return (
		<View className="gap-4">
			<ActionSurface
				accessibilityHint="Öffnet alle Themen und Wissensbelege."
				accessibilityLabel={knowledgeAccessibilityLabel}
				accessibilityRole="button"
				className="flex-row items-center gap-4 rounded-card border border-border bg-card p-5 shadow-none"
				onPress={onOpenKnowledge}
				style={continuousCardStyle}
				variant="flat"
			>
				<KnowledgeProgressRing
					secureTopics={analysis.readiness.secure}
					totalTopics={totalTopics}
				/>
				<View className="min-w-0 flex-1 gap-1">
					<Text className="font-poppins font-semibold text-body-3 text-primary-strong">
						Dein Wissensstand
					</Text>
					<Text
						selectable
						className="font-poppins text-body-4 text-secondary-text"
						numberOfLines={2}
					>
						{hasTopics ? "Themen sicher belegt" : "Noch keine Themen bewertet"}
					</Text>
				</View>
				<ArrowRight size={19} color={colors.secondaryText} strokeWidth={2.2} />
			</ActionSurface>

			<ActionSurface
				accessibilityHint="Öffnet die Antwort und die genaue Diagnose."
				accessibilityLabel={`Lernhürde: ${
					primaryProblem?.observation ?? "Noch keine klare Schwäche erkannt"
				} Details öffnen`}
				accessibilityRole="button"
				className="gap-4 rounded-card border border-wrong/20 bg-card p-5 shadow-none"
				onPress={onOpenProblem}
				style={continuousCardStyle}
				variant="flat"
			>
				<View className="flex-row items-center justify-between gap-4">
					<View className="flex-row items-center gap-3">
						<View className="h-10 w-10 items-center justify-center rounded-full bg-wrong-subtle">
							<CircleAlert size={20} color={colors.wrong} strokeWidth={2.2} />
						</View>
						<Text className="font-poppins font-semibold text-body-3 text-wrong">
							Größte Lernhürde
						</Text>
					</View>
					<ArrowRight
						size={19}
						color={colors.secondaryText}
						strokeWidth={2.2}
					/>
				</View>
				<View className="gap-2">
					<Text
						selectable
						className="font-poppins font-semibold text-body-2 text-text"
						numberOfLines={3}
					>
						{formatGermanUiText(
							primaryProblem?.observation ??
								"Noch keine klare Schwäche erkannt",
						)}
					</Text>
					<Text
						selectable
						className="font-poppins text-body-4 text-secondary-text"
						numberOfLines={2}
					>
						{primaryProblem?.evidenceExcerpt
							? `Deine Antwort: „${primaryProblem.evidenceExcerpt}“`
							: "Noch nicht genug Belege für eine konkrete Diagnose."}
					</Text>
				</View>
				{analysis.secondaryProblems.length > 0 ? (
					<Text className="font-poppins font-semibold text-body-5 text-wrong">
						{`${analysis.secondaryProblems.length} weitere ${analysis.secondaryProblems.length === 1 ? "Lernhürde" : "Lernhürden"} ansehen`}
					</Text>
				) : null}
			</ActionSurface>

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

function ReadinessSummary({ analysis }: { analysis: ExamAnalysis }) {
	const statusItems = [
		{
			label: "Sicher",
			value: analysis.readiness.secure,
			className: "bg-success-subtle",
			valueClassName: "text-success",
		},
		{
			label: "In Arbeit",
			value: analysis.readiness.developing,
			className: "bg-info-subtle",
			valueClassName: "text-info",
		},
		{
			label: "Noch unklar",
			value: analysis.readiness.unknown,
			className: "bg-system-subtle",
			valueClassName: "text-primary-strong",
		},
	];

	return (
		<Surface className="gap-5 p-5" variant="flat">
			<View className="flex-row items-start justify-between gap-4">
				<View className="min-w-0 flex-1 gap-1">
					<Text
						selectable
						className="font-poppins font-semibold text-body-1 text-text"
					>
						Dein aktueller Stand
					</Text>
					<Text
						selectable
						className="font-poppins text-body-4 text-secondary-text"
					>
						{analysis.preliminary
							? "Erste Einschätzung aus deinen Antworten. Sie wird mit jeder Einheit genauer."
							: "Aus deinen bisherigen Antworten für diese Prüfung."}
					</Text>
				</View>
				{analysis.preliminary ? (
					<View className="rounded-full bg-system-subtle px-3 py-1.5">
						<Text className="font-poppins font-semibold text-body-5 text-primary-strong">
							Erste Einschätzung
						</Text>
					</View>
				) : null}
			</View>
			<View className="flex-row gap-2">
				{statusItems.map((item) => (
					<View
						key={item.label}
						accessible
						accessibilityLabel={`${item.label}: ${item.value} Themen`}
						className={cn(
							"min-w-0 flex-1 items-center gap-0.5 rounded-info px-2 py-4",
							item.className,
						)}
					>
						<Text
							selectable
							className={cn(
								"font-poppins font-semibold text-heading-2",
								item.valueClassName,
							)}
							style={{ fontVariant: ["tabular-nums"] }}
						>
							{item.value}
						</Text>
						<Text className="text-center font-poppins font-semibold text-body-5 text-secondary-text">
							{item.label}
						</Text>
					</View>
				))}
			</View>
		</Surface>
	);
}

function AbilitySection({
	abilities,
}: {
	abilities: ExamAnalysis["abilities"];
}) {
	if (abilities.length === 0) {
		return (
			<View className="gap-4">
				<SectionHeading title="Das kannst du schon" />
				<Surface className="gap-2 p-5" variant="flat">
					<Text
						selectable
						className="font-poppins font-semibold text-body-3 text-text"
					>
						Noch nicht genug Belege
					</Text>
					<Text
						selectable
						className="font-poppins text-body-4 text-secondary-text"
					>
						Nach deinen nächsten schriftlichen oder gesprochenen Antworten kann
						Dayova deine Fähigkeiten genauer benennen.
					</Text>
				</Surface>
			</View>
		);
	}

	return (
		<View className="gap-4">
			<SectionHeading
				title="Das kannst du schon"
				description="Konkrete Fähigkeiten, die du bereits gezeigt hast."
			/>
			<View className="gap-3">
				{abilities.map((ability) => (
					<Surface
						key={ability.statement}
						accessible
						accessibilityLabel={`${ability.statement} Belegt durch ${ability.evidenceCount} Antworten.`}
						className="flex-row items-start gap-3 p-5"
						variant="flat"
					>
						<View className="h-8 w-8 items-center justify-center rounded-full bg-success-subtle">
							<Check
								size={17}
								color={DAYOVA_DESIGN_SYSTEM.colors.success}
								strokeWidth={2.4}
							/>
						</View>
						<View className="min-w-0 flex-1 gap-1">
							<Text
								selectable
								className="font-poppins font-semibold text-body-3 text-text"
							>
								{ability.statement}
							</Text>
							<Text
								selectable
								className="font-poppins text-body-5 text-secondary-text"
							>
								{`Belegt durch ${ability.evidenceCount} ${ability.evidenceCount === 1 ? "Antwort" : "Antworten"}`}
							</Text>
						</View>
					</Surface>
				))}
			</View>
		</View>
	);
}

function ImprovementSection({
	improvements,
}: {
	improvements: ExamAnalysis["improvements"];
}) {
	if (improvements.length === 0) return null;

	return (
		<View className="gap-4">
			<SectionHeading
				title="Das hast du verbessert"
				description="Neuere Antworten ersetzen frühere Unsicherheiten."
			/>
			<Surface className="gap-4 bg-success-subtle p-5" variant="flat">
				{improvements.map((improvement) => (
					<View
						key={improvement.statement}
						className="flex-row items-start gap-3"
					>
						<Check
							size={19}
							color={DAYOVA_DESIGN_SYSTEM.colors.success}
							strokeWidth={2.3}
						/>
						<Text
							selectable
							className="min-w-0 flex-1 font-poppins text-body-3 text-text"
						>
							{improvement.statement}
						</Text>
					</View>
				))}
			</Surface>
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

function TopicOverview({ topics }: { topics: ExamAnalysis["topics"] }) {
	return (
		<View className="gap-4">
			<SectionHeading
				title="Dein Prüfungsstoff"
				description="Auch ungetestete Themen bleiben sichtbar."
			/>
			<Surface className="overflow-hidden" variant="flat">
				{topics.map((topic, index) => {
					const status = TOPIC_STATUS_COPY[topic.status];
					return (
						<View
							key={topic.id}
							accessible
							accessibilityLabel={`${topic.title}. ${status.label}. ${PRIORITY_COPY[topic.priority]}.`}
							className={cn(
								"flex-row items-center gap-3 px-5 py-4",
								index > 0 && "border-border border-t",
							)}
						>
							<View
								accessible={false}
								className={cn("h-3 w-3 rounded-full", status.dotClassName)}
							/>
							<View className="min-w-0 flex-1 gap-0.5">
								<Text
									selectable
									className="font-poppins font-semibold text-body-3 text-text"
								>
									{formatGermanUiText(topic.title)}
								</Text>
								<Text
									selectable
									className="font-poppins text-body-5 text-secondary-text"
								>
									{PRIORITY_COPY[topic.priority]}
								</Text>
							</View>
							<View
								className={cn("rounded-full px-3 py-1.5", status.pillClassName)}
							>
								<Text
									className={cn(
										"font-poppins font-semibold text-body-5",
										status.textClassName,
									)}
								>
									{status.label}
								</Text>
							</View>
						</View>
					);
				})}
			</Surface>
		</View>
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

export function AnalyticsScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [selectedPlanId, setSelectedPlanId] =
		useState<Id<"learningPlans"> | null>(null);
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
				<View className="flex-row items-center justify-between">
					<View className="min-w-0 flex-1 pr-4">
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
								numberOfLines={1}
							>
								{selectedExamContext}
							</Text>
						) : null}
					</View>
					<View className="flex-row items-center gap-2">
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
							onOpenKnowledge={() => {
								if (selectedPlanIdForRoute) {
									router.push({
										pathname: ROUTES.analyticsKnowledge,
										params: { planId: selectedPlanIdForRoute },
									});
								}
							}}
							onOpenNextStep={() => {
								if (selectedPlanIdForRoute) {
									router.push({
										pathname: ROUTES.analyticsNextStep,
										params: { planId: selectedPlanIdForRoute },
									});
								}
							}}
							onOpenProblem={() => {
								if (selectedPlanIdForRoute) {
									router.push({
										pathname: ROUTES.analyticsProblem,
										params: { planId: selectedPlanIdForRoute },
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

const DETAIL_DESCRIPTION: Record<AnalyticsDetailSection, string> = {
	knowledge:
		"Was du sicher kannst, was noch offen ist und wie dein Prüfungsstoff eingeordnet wird.",
	problem:
		"Welche Antwort die Hürde zeigt und welches Missverständnis dahinterliegt.",
	nextStep:
		"Was du jetzt konkret tun solltest und wie es bis zur Prüfung in deine Zeit passt.",
};

function AnalyticsDetailContent({
	analysis,
	onOpenPlan,
	onOpenSession,
	section,
}: {
	analysis: ExamAnalysis;
	onOpenPlan: () => void;
	onOpenSession: (sessionId: Id<"learningPlanSessions">) => void;
	section: AnalyticsDetailSection;
}) {
	if (section === "knowledge") {
		return (
			<View className="gap-9">
				<ReadinessSummary analysis={analysis} />
				<AbilitySection abilities={analysis.abilities} />
				<ImprovementSection improvements={analysis.improvements} />
				<TopicOverview topics={analysis.topics} />
			</View>
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
}: {
	planId?: Id<"learningPlans">;
	section: AnalyticsDetailSection;
}) {
	const router = useRouter();
	const analysis = useExamAnalysisQuery(planId);
	const selectedPlanIdForRoute = analysis?.selectedPlan?.id ?? planId ?? null;
	const selectedExamContext =
		analysis?.hasData && analysis.selectedPlan
			? formatGermanUiText(
					`${analysis.selectedPlan.subject} · ${analysis.selectedPlan.examTypeLabel}`,
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
								<Text className="font-poppins font-semibold text-body-4 text-primary-strong">
									{selectedExamContext}
								</Text>
							) : null}
							<Text
								selectable
								className="font-poppins text-body-2 text-secondary-text"
							>
								{DETAIL_DESCRIPTION[section]}
							</Text>
						</View>
						<AnalyticsDetailContent
							analysis={analysis}
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
