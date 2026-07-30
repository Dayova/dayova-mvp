import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { NotificationButton } from "~/components/notification-button";
import { AnimatedFlowerLoader } from "~/components/ui/animated-flower-loader";
import { Button } from "~/components/ui/button";
import {
	ArrowUpRight,
	CalendarDays,
	Check,
	ChevronDown,
	Info,
	Route2,
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

function ExamSelector({
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
				accessibilityLabel={`Prüfung auswählen. Ausgewählt: ${selectedLabel}`}
				accessibilityRole="button"
				accessibilityState={{ expanded: visible }}
				className="flex-row items-center gap-4 px-5 py-4"
				onPress={onOpen}
				variant="flat"
			>
				<View className="h-11 w-11 items-center justify-center rounded-full bg-system-subtle">
					<Route2 size={21} color={colors.primaryStrong} strokeWidth={2.2} />
				</View>
				<View className="min-w-0 flex-1 gap-0.5">
					<Text
						selectable
						className="font-poppins font-semibold text-body-2 text-text"
						numberOfLines={1}
					>
						{formatGermanUiText(
							`${selectedPlan.subject} · ${selectedPlan.examTypeLabel}`,
						)}
					</Text>
					<Text
						selectable
						className="font-poppins text-body-4 text-secondary-text"
						numberOfLines={1}
					>
						{`${selectedPlan.examDateLabel} · ${formatRemainingDays(selectedPlan.daysRemaining)}`}
					</Text>
				</View>
				<ChevronDown size={20} color={colors.secondaryText} strokeWidth={2.1} />
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

function ProblemCard({
	problem,
	compact = false,
}: {
	problem: ExamProblem;
	compact?: boolean;
}) {
	const diagnosis = DIAGNOSIS_COPY[problem.diagnosisType];

	if (compact) {
		return (
			<Surface className="gap-3 p-5" variant="flat">
				<View className="flex-row items-center justify-between gap-3">
					<Text
						selectable
						className="min-w-0 flex-1 font-poppins font-semibold text-body-3 text-text"
					>
						{problem.title}
					</Text>
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
				</View>
				<Text
					selectable
					className="font-poppins text-body-4 text-secondary-text"
				>
					{problem.observation}
				</Text>
			</Surface>
		);
	}

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
					{problem.observation}
				</Text>
			</View>

			{problem.evidenceExcerpt ? (
				<View className="gap-2 rounded-info bg-background p-4">
					<Text className="font-poppins font-semibold text-body-5 text-secondary-text">
						Deine Antwort
					</Text>
					<Text
						selectable
						className="font-poppins text-body-3 text-text"
					>{`„${problem.evidenceExcerpt}“`}</Text>
				</View>
			) : null}

			<View className="gap-4">
				<View className="gap-1">
					<Text className="font-poppins font-semibold text-body-4 text-secondary-text">
						Hier zeigt es sich
					</Text>
					<Text selectable className="font-poppins text-body-3 text-text">
						{problem.location}
					</Text>
				</View>
				<View className="gap-1">
					<Text className="font-poppins font-semibold text-body-4 text-secondary-text">
						Was dahinter steckt
					</Text>
					<Text selectable className="font-poppins text-body-3 text-text">
						{problem.explanation}
					</Text>
				</View>
			</View>
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
						<ProblemCard key={problem.id} compact problem={problem} />
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

function ExamAnalysisContent({
	analysis,
	onOpenPlan,
	onOpenSession,
}: {
	analysis: ExamAnalysis;
	onOpenPlan: () => void;
	onOpenSession: (sessionId: Id<"learningPlanSessions">) => void;
}) {
	return (
		<View className="gap-9">
			<ReadinessSummary analysis={analysis} />
			<AbilitySection abilities={analysis.abilities} />
			<ImprovementSection improvements={analysis.improvements} />
			<ProblemSection
				primaryProblem={analysis.primaryProblem}
				secondaryProblems={analysis.secondaryProblems}
			/>
			<RecommendationSection
				analysis={analysis}
				onOpenPlan={onOpenPlan}
				onOpenSession={onOpenSession}
			/>
			<TopicOverview topics={analysis.topics} />
			<PreparationSummary analysis={analysis} onOpenPlan={onOpenPlan} />
		</View>
	);
}

export function AnalyticsScreen() {
	const router = useRouter();
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const today = useCurrentLocalDay();
	const [selectedPlanId, setSelectedPlanId] =
		useState<Id<"learningPlans"> | null>(null);
	const [isSelectorOpen, setIsSelectorOpen] = useState(false);
	const queryArgs = useMemo(
		() => ({
			todayKey: getDayKey(today),
			...(selectedPlanId ? { learningPlanId: selectedPlanId } : {}),
		}),
		[selectedPlanId, today],
	);
	const analysis = useQuery(
		api.userAnalytics.getExamAnalysis,
		user && isConvexAuthenticated ? queryArgs : "skip",
	);

	const selectedPlanIdForRoute =
		analysis?.selectedPlan?.id ?? selectedPlanId ?? null;

	return (
		<Screen>
			<ThemedStatusBar />
			<ScreenScroll topPadding={84} bottomPadding={150} horizontalPadding={24}>
				<View className="flex-row items-center justify-between">
					<Text className="font-poppins font-semibold text-heading-2 text-text">
						Analyse
					</Text>
					<NotificationButton />
				</View>

				<View className="mt-7 gap-7">
					{analysis?.hasData ? (
						<ExamSelector
							analysis={analysis}
							onClose={() => setIsSelectorOpen(false)}
							onOpen={() => setIsSelectorOpen(true)}
							onSelect={setSelectedPlanId}
							visible={isSelectorOpen}
						/>
					) : null}
					{analysis === undefined ? (
						<LoadingState />
					) : analysis.hasData ? (
						<ExamAnalysisContent
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
