import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
	Pressable,
	useWindowDimensions,
	View,
	type ViewProps,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { api } from "#convex/_generated/api";
import { NotificationButton } from "~/components/notification-button";
import { AnimatedFlowerLoader } from "~/components/ui/animated-flower-loader";
import { Button } from "~/components/ui/button";
import {
	ArrowUpRight,
	Check,
	CircleAlert,
	Fire,
	Route2,
	Sparkles,
	Time04,
} from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { ActionSurface, Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthSession } from "~/context/AuthContext";
import { getDayKey, parseDayKey, useCurrentLocalDay } from "~/lib/day-key";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { ROUTES } from "~/lib/routes";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

type AnalyticsPeriod = "week" | "month" | "all";
type AnalyticsOverview = NonNullable<
	ReturnType<typeof useQuery<typeof api.userAnalytics.getOverview>>
>;

const PERIOD_OPTIONS: Array<{
	value: AnalyticsPeriod;
	label: string;
}> = [
	{ value: "week", label: "7 Tage" },
	{ value: "month", label: "30 Tage" },
	{ value: "all", label: "Gesamt" },
];

const formatMinutes = (minutes: number) => {
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;
	return remainder > 0 ? `${hours} h ${remainder} min` : `${hours} h`;
};

const formatCompactDay = (dayKey: string) => {
	const date = parseDayKey(dayKey);
	if (!date) return dayKey;
	return new Intl.DateTimeFormat("de-DE", {
		day: "2-digit",
		month: "2-digit",
	}).format(date);
};

function PeriodSelector({
	period,
	onChange,
}: {
	period: AnalyticsPeriod;
	onChange: (period: AnalyticsPeriod) => void;
}) {
	return (
		<View
			accessibilityRole="tablist"
			className="flex-row rounded-full border border-border bg-card p-1"
		>
			{PERIOD_OPTIONS.map((option) => {
				const selected = option.value === period;
				return (
					<Pressable
						key={option.value}
						accessibilityRole="tab"
						accessibilityState={{ selected }}
						className={cn(
							"h-11 flex-1 items-center justify-center rounded-full",
							selected ? "bg-button-neutral" : "bg-transparent",
						)}
						onPress={() => onChange(option.value)}
					>
						<Text
							className={cn(
								"font-poppins font-semibold text-body-4",
								selected ? "text-background" : "text-secondary-text",
							)}
						>
							{option.label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

function ProgressRing({
	progressPercent,
	size = 112,
}: {
	progressPercent: number;
	size?: number;
}) {
	const { colors } = useDayovaTheme();
	const strokeWidth = 9;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const progress = Math.max(0, Math.min(progressPercent, 100));

	return (
		<View
			accessible
			accessibilityLabel="Fortschritt deiner Lernpläne"
			accessibilityRole="progressbar"
			accessibilityValue={{
				min: 0,
				max: 100,
				now: progress,
				text: `${progress} Prozent`,
			}}
			className="items-center justify-center"
			style={{ height: size, width: size }}
		>
			<Svg
				accessible={false}
				accessibilityElementsHidden
				width={size}
				height={size}
				style={{ position: "absolute" }}
			>
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					stroke={colors.light2}
					strokeWidth={strokeWidth}
					fill="none"
				/>
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					stroke={colors.primaryStrong}
					strokeWidth={strokeWidth}
					fill="none"
					strokeLinecap="round"
					strokeDasharray={`${circumference} ${circumference}`}
					strokeDashoffset={circumference - (progress / 100) * circumference}
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
				/>
			</Svg>
			<Text
				selectable
				className="font-poppins font-semibold text-heading-2 text-text"
				style={{ fontVariant: ["tabular-nums"] }}
			>
				{`${progress}%`}
			</Text>
		</View>
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
			<Text className="font-poppins font-semibold text-body-1 text-text">
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

function MetricCard({
	icon,
	label,
	value,
}: {
	icon: React.JSX.Element;
	label: string;
	value: string;
}) {
	return (
		<Surface
			accessible
			accessibilityLabel={`${label}: ${value}`}
			className="min-w-0 flex-1 gap-3 px-3 py-4"
			variant="flat"
		>
			<View className="h-9 w-9 items-center justify-center rounded-full bg-system-subtle">
				{icon}
			</View>
			<View className="gap-0.5">
				<Text
					selectable
					className="font-poppins font-semibold text-body-2 text-text"
					numberOfLines={1}
					adjustsFontSizeToFit
					style={{ fontVariant: ["tabular-nums"] }}
				>
					{value}
				</Text>
				<Text
					className="font-poppins text-body-5 text-secondary-text"
					numberOfLines={1}
				>
					{label}
				</Text>
			</View>
		</Surface>
	);
}

function ActivityChart({
	activity,
	period,
}: {
	activity: AnalyticsOverview["activity"];
	period: AnalyticsPeriod;
}) {
	const { width } = useWindowDimensions();
	const { colors } = useDayovaTheme();
	const maxValue = Math.max(
		1,
		...activity.map((point) =>
			Math.max(point.activeStudyMinutes, point.completedSessions * 5),
		),
	);
	const chartWidth = Math.max(width - 88, 220);
	const gap = activity.length <= 7 ? 8 : 3;
	const barWidth = Math.max(
		4,
		(chartWidth - gap * Math.max(activity.length - 1, 0)) /
			Math.max(activity.length, 1),
	);
	const totalMinutes = activity.reduce(
		(total, point) => total + point.activeStudyMinutes,
		0,
	);
	const totalSessions = activity.reduce(
		(total, point) => total + point.completedSessions,
		0,
	);

	if (activity.length === 0) return null;

	return (
		<Surface className="gap-5 p-5" variant="flat">
			<View
				accessible
				accessibilityLabel={`Lernaktivität: ${formatMinutes(totalMinutes)} aktive Lernzeit und ${totalSessions} abgeschlossene Einheiten im Diagrammzeitraum.`}
				className="h-32 flex-row items-end"
				style={{ columnGap: gap }}
			>
				{activity.map((point) => {
					const value = Math.max(
						point.activeStudyMinutes,
						point.completedSessions * 5,
					);
					const height = value > 0 ? Math.max(10, (value / maxValue) * 112) : 4;
					return (
						<View
							key={point.dayKey}
							accessible={false}
							className="rounded-full bg-progress-track"
							style={{
								width: barWidth,
								height,
								backgroundColor:
									value > 0 ? colors.primaryStrong : colors.light2,
							}}
						/>
					);
				})}
			</View>
			<View className="flex-row justify-between">
				<Text className="font-poppins text-body-5 text-secondary-text">
					{formatCompactDay(activity[0].dayKey)}
				</Text>
				<Text className="font-poppins text-body-5 text-secondary-text">
					{period === "all" ? "Letzte 30 Tage" : "Lernaktivität"}
				</Text>
				<Text className="font-poppins text-body-5 text-secondary-text">
					{formatCompactDay(activity.at(-1)?.dayKey ?? "")}
				</Text>
			</View>
		</Surface>
	);
}

function PlanProgressCard({
	plan,
	onPress,
}: {
	plan: AnalyticsOverview["plans"][number];
	onPress: () => void;
}) {
	const { colors } = useDayovaTheme();
	const title = formatGermanUiText(
		`${plan.subject} ${plan.examTypeLabel}`.trim(),
	);

	return (
		<ActionSurface
			accessibilityLabel={`${title}, ${plan.progressPercent} Prozent abgeschlossen`}
			accessibilityHint="Öffnet den Lernplan."
			className="gap-4 p-5"
			onPress={onPress}
			variant="flat"
		>
			<View className="flex-row items-center gap-4">
				<View className="h-11 w-11 items-center justify-center rounded-full bg-system-subtle">
					<Route2 size={21} color={colors.primaryStrong} strokeWidth={2} />
				</View>
				<View className="min-w-0 flex-1">
					<Text
						className="font-poppins font-semibold text-body-2 text-text"
						numberOfLines={2}
					>
						{title}
					</Text>
					<Text
						selectable
						className="font-poppins text-body-4 text-secondary-text"
					>
						{plan.examDateLabel}
					</Text>
				</View>
				<Text
					selectable
					className="font-poppins font-semibold text-body-2 text-text"
					style={{ fontVariant: ["tabular-nums"] }}
				>
					{`${plan.progressPercent}%`}
				</Text>
			</View>
			<View
				accessible
				accessibilityRole="progressbar"
				accessibilityValue={{
					min: 0,
					max: plan.totalSessions,
					now: plan.completedSessions,
					text: `${plan.completedSessions} von ${plan.totalSessions} Einheiten`,
				}}
				className="h-2 overflow-hidden rounded-full bg-progress-track"
			>
				<View
					className="h-full rounded-full bg-primary-strong"
					style={{ width: `${plan.progressPercent}%` }}
				/>
			</View>
			<Text
				selectable
				className="font-poppins text-body-5 text-secondary-text"
				style={{ fontVariant: ["tabular-nums"] }}
			>
				{`${plan.completedSessions} von ${plan.totalSessions} Einheiten abgeschlossen`}
			</Text>
		</ActionSurface>
	);
}

function KnowledgeLegendItem({
	color,
	label,
	value,
}: {
	color: string;
	label: string;
	value: number;
}) {
	return (
		<View className="flex-row items-center gap-2">
			<View
				accessible={false}
				className="h-2.5 w-2.5 rounded-full"
				style={{ backgroundColor: color }}
			/>
			<Text className="font-poppins text-body-5 text-secondary-text">
				{`${label} ${value}`}
			</Text>
		</View>
	);
}

function InsightList({
	icon,
	items,
	title,
}: {
	icon: (props: {
		size?: number;
		color?: string;
		strokeWidth?: number;
	}) => React.JSX.Element;
	items: string[];
	title: string;
}) {
	const Icon = icon;
	const { colors } = useDayovaTheme();
	if (items.length === 0) return null;

	return (
		<View className="gap-3">
			<Text className="font-poppins font-semibold text-body-3 text-text">
				{title}
			</Text>
			{items.map((item) => (
				<View key={item} className="flex-row items-start gap-3">
					<View className="pt-0.5">
						<Icon
							size={18}
							color={
								title === "Das sitzt schon" ? colors.success : colors.wrong
							}
							strokeWidth={2}
						/>
					</View>
					<Text
						selectable
						className="min-w-0 flex-1 font-poppins text-body-4 text-text"
					>
						{item}
					</Text>
				</View>
			))}
		</View>
	);
}

function KnowledgeCard({
	knowledge,
}: {
	knowledge: AnalyticsOverview["knowledge"];
}) {
	const { colors } = useDayovaTheme();
	const score = knowledge.scorePercent ?? 0;
	const correctWidth =
		knowledge.answeredItems > 0
			? (knowledge.correct / knowledge.answeredItems) * 100
			: 0;
	const partialWidth =
		knowledge.answeredItems > 0
			? (knowledge.partiallyCorrect / knowledge.answeredItems) * 100
			: 0;
	const incorrectWidth = Math.max(0, 100 - correctWidth - partialWidth);

	if (
		knowledge.answeredItems === 0 &&
		knowledge.strengths.length === 0 &&
		knowledge.gaps.length === 0
	) {
		return (
			<Surface className="gap-2 p-5" variant="flat">
				<Text className="font-poppins font-semibold text-body-3 text-text">
					Noch kein Wissensbild
				</Text>
				<Text
					selectable
					className="font-poppins text-body-4 text-secondary-text"
				>
					Nach deiner ersten Übungs- oder Praxiseinheit siehst du hier, was
					schon sitzt und was du als Nächstes festigen kannst.
				</Text>
			</Surface>
		);
	}

	return (
		<Surface className="gap-6 p-5" variant="flat">
			{knowledge.answeredItems > 0 ? (
				<View className="gap-4">
					<View className="flex-row items-end justify-between">
						<View className="gap-1">
							<Text className="font-poppins text-body-4 text-secondary-text">
								Antwortqualität
							</Text>
							<Text
								selectable
								className="font-poppins font-semibold text-heading-2 text-text"
								style={{ fontVariant: ["tabular-nums"] }}
							>
								{`${score}%`}
							</Text>
						</View>
						<Text
							selectable
							className="font-poppins text-body-5 text-secondary-text"
						>
							{`${knowledge.answeredItems} ausgewertete Antworten`}
						</Text>
					</View>
					<View
						accessible
						accessibilityLabel={`${knowledge.correct} richtig, ${knowledge.partiallyCorrect} teilweise richtig, ${knowledge.notCorrect} noch offen`}
						className="h-3 flex-row overflow-hidden rounded-full bg-progress-track"
					>
						<View
							className="h-full"
							style={{
								width: `${correctWidth}%`,
								backgroundColor: colors.success,
							}}
						/>
						<View
							className="h-full"
							style={{
								width: `${partialWidth}%`,
								backgroundColor: colors.info,
							}}
						/>
						<View
							className="h-full"
							style={{
								width: `${incorrectWidth}%`,
								backgroundColor: colors.wrong,
							}}
						/>
					</View>
					<View className="flex-row flex-wrap gap-x-4 gap-y-2">
						<KnowledgeLegendItem
							color={colors.success}
							label="Richtig"
							value={knowledge.correct}
						/>
						<KnowledgeLegendItem
							color={colors.info}
							label="Teilweise"
							value={knowledge.partiallyCorrect}
						/>
						<KnowledgeLegendItem
							color={colors.wrong}
							label="Offen"
							value={knowledge.notCorrect}
						/>
					</View>
				</View>
			) : null}
			<InsightList
				icon={Check}
				items={knowledge.strengths}
				title="Das sitzt schon"
			/>
			<InsightList
				icon={CircleAlert}
				items={knowledge.gaps}
				title="Als Nächstes festigen"
			/>
			{knowledge.recommendation ? (
				<View className="flex-row items-start gap-3 rounded-info bg-system-subtle p-4">
					<Sparkles size={19} color={colors.primaryStrong} strokeWidth={2} />
					<Text
						selectable
						className="min-w-0 flex-1 font-poppins text-body-4 text-text"
					>
						{knowledge.recommendation}
					</Text>
				</View>
			) : null}
		</Surface>
	);
}

function LoadingState() {
	return (
		<View
			accessibilityLabel="Analyse wird geladen"
			accessibilityLiveRegion="polite"
			className="items-center gap-4 py-24"
		>
			<AnimatedFlowerLoader size={104} />
			<Text className="font-poppins text-body-4 text-secondary-text">
				Deine Analyse wird geladen …
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
					Hier wächst deine Analyse
				</Text>
				<Text
					selectable
					className="text-center font-poppins text-body-4 text-secondary-text"
				>
					Erstelle deinen ersten Lernplan. Sobald du lernst, siehst du hier
					deinen Fortschritt, deine Lernzeit und dein Wissensbild.
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

function AnalyticsContent({
	data,
	period,
	onOpenPlan,
	onOpenNextSession,
}: {
	data: AnalyticsOverview;
	period: AnalyticsPeriod;
	onOpenPlan: (planId: string) => void;
	onOpenNextSession: (planId: string, sessionId: string) => void;
}) {
	const { colors } = useDayovaTheme();
	const periodLabel =
		period === "week"
			? "in den letzten 7 Tagen"
			: period === "month"
				? "in den letzten 30 Tagen"
				: "insgesamt";

	return (
		<View className="gap-9">
			<Surface className="gap-6 p-6">
				<View className="flex-row items-center gap-5">
					<ProgressRing progressPercent={data.overall.progressPercent} />
					<View className="min-w-0 flex-1 gap-2">
						<Text className="font-poppins font-semibold text-body-1 text-text">
							Dein Lernfortschritt
						</Text>
						<Text
							selectable
							className="font-poppins text-body-4 text-secondary-text"
						>
							{data.overall.totalSessions > 0
								? `${data.overall.completedSessions} von ${data.overall.totalSessions} geplanten Einheiten sind geschafft.`
								: "Deine geplanten Einheiten erscheinen hier, sobald dein Lernplan bereit ist."}
						</Text>
					</View>
				</View>
				{data.nextSession ? (
					<Button
						accessibilityHint="Öffnet die nächste relevante Lerneinheit."
						onPress={() =>
							onOpenNextSession(
								data.nextSession?.learningPlanId ?? "",
								data.nextSession?.id ?? "",
							)
						}
					>
						<Text numberOfLines={1}>
							{`${formatGermanUiText(data.nextSession.subject)} weiterlernen`}
						</Text>
						<ArrowUpRight size={20} color="#FFFFFF" strokeWidth={2} />
					</Button>
				) : null}
			</Surface>

			<View className="gap-4">
				<SectionHeading
					title="Dein Einsatz"
					description={`Was du ${periodLabel} umgesetzt hast.`}
				/>
				<View className="flex-row gap-3">
					<MetricCard
						icon={
							<Time04 size={19} color={colors.primaryStrong} strokeWidth={2} />
						}
						label="Lernzeit"
						value={formatMinutes(data.period.activeStudyMinutes)}
					/>
					<MetricCard
						icon={
							<Check size={19} color={colors.primaryStrong} strokeWidth={2} />
						}
						label="Einheiten"
						value={data.period.completedSessions.toString()}
					/>
					<MetricCard
						icon={
							<Fire size={19} color={colors.primaryStrong} strokeWidth={2} />
						}
						label="Lernserie"
						value={`${data.currentStreakDays} T`}
					/>
				</View>
				{data.period.recoveredSessions > 0 ? (
					<View className="flex-row items-start gap-3 rounded-info bg-success-subtle p-4">
						<Check size={19} color={colors.success} strokeWidth={2.2} />
						<Text
							selectable
							className="min-w-0 flex-1 font-poppins text-body-4 text-text"
						>
							{data.period.recoveredSessions === 1
								? "Du hast einen verschobenen Lernblock erfolgreich nachgeholt."
								: `Du hast ${data.period.recoveredSessions} verschobene Lernblöcke erfolgreich nachgeholt.`}
						</Text>
					</View>
				) : null}
				<ActivityChart activity={data.activity} period={period} />
			</View>

			<View className="gap-4">
				<SectionHeading
					title="Deine Lernpläne"
					description={`${data.overall.finishedPlans} von ${data.overall.acceptedPlans} Plänen vollständig abgeschlossen.`}
				/>
				<View className="gap-3">
					{data.plans.map((plan) => (
						<PlanProgressCard
							key={plan.id}
							plan={plan}
							onPress={() => onOpenPlan(plan.id)}
						/>
					))}
				</View>
			</View>

			<View className="gap-4">
				<SectionHeading
					title="Dein Wissensbild"
					description={`Aus deinen ausgewerteten Antworten ${periodLabel}.`}
				/>
				<KnowledgeCard knowledge={data.knowledge} />
			</View>

			{data.historyLimited ? (
				<Text
					selectable
					className="text-center font-poppins text-body-5 text-secondary-text"
				>
					Bei sehr umfangreichen Verläufen zeigt Dayova die neuesten Aktivitäten
					und Analysen.
				</Text>
			) : null}
		</View>
	);
}

export function AnalyticsScreen(_props: ViewProps) {
	const router = useRouter();
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const today = useCurrentLocalDay();
	const [period, setPeriod] = useState<AnalyticsPeriod>("week");
	const queryArgs = useMemo(
		() => ({
			period,
			todayKey: getDayKey(today),
			timezoneOffsetMinutes: today.getTimezoneOffset(),
		}),
		[period, today],
	);
	const data = useQuery(
		api.userAnalytics.getOverview,
		user && isConvexAuthenticated ? queryArgs : "skip",
	);

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
					<PeriodSelector period={period} onChange={setPeriod} />
					{data === undefined ? (
						<LoadingState />
					) : data.hasData ? (
						<AnalyticsContent
							data={data}
							period={period}
							onOpenPlan={(planId) => router.push(`/learning-plans/${planId}`)}
							onOpenNextSession={(planId, sessionId) =>
								router.push(`/learning-plans/${planId}/sessions/${sessionId}`)
							}
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
