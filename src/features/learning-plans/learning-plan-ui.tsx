import { type ReactNode, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { Button } from "~/components/ui/button";
import {
	FieldAccessory,
	FieldLabel,
	FieldTrigger,
} from "~/components/ui/field";
import {
	Attachment,
	CalendarDays,
	ChevronDown,
	Clock3,
	PropertyEdit,
	X,
} from "~/components/ui/icon";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { ActionSurface, Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { WarningBanner } from "~/components/ui/warning-banner";
import type {
	PlanSession,
	SessionPhase,
} from "~/features/learning-plans/types";
import {
	formatDate,
	formatDayOfMonth,
	formatShortWeekday,
	minutesFromTime,
	parseDateKey,
	timeFromMinutes,
} from "~/features/learning-plans/utils";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { useDayovaTheme } from "~/lib/theme";
import { formatFileSize } from "~/lib/upload-policy";
import { cn } from "~/lib/utils";
import { MISSING_LEARNING_TIMES_HINT } from "../../../convex/learningPlanPlanningHints";

const phaseEditCopy: Record<
	SessionPhase,
	{ actionLabel: string; fieldLabel: string }
> = {
	theory: { actionLabel: "Lernen", fieldLabel: "Theorie" },
	practice: { actionLabel: "Üben", fieldLabel: "Üben" },
	rehearsal: { actionLabel: "Praxis", fieldLabel: "Praxis" },
};

const getSessionEditTitle = (session: PlanSession) =>
	`${session.sortOrder + 1}. ${phaseEditCopy[session.phase].actionLabel} bearbeiten`;

const getSessionPhaseLabel = (phase: SessionPhase) =>
	phaseEditCopy[phase].fieldLabel;

const sessionPhaseOptions: SessionPhase[] = ["theory", "practice", "rehearsal"];

export function SectionTitle({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<View className="mb-7">
			<Text className="font-poppins font-semibold text-body-1 text-text">
				{title}
			</Text>
			<Text className="mt-2 font-poppins text-body-3 text-text/55">
				{description}
			</Text>
		</View>
	);
}

const getPlanningHintCtaLabel = (hint: string) => {
	if (hint.includes(MISSING_LEARNING_TIMES_HINT)) return "Lernzeiten eintragen";
	if (hint.includes("Lernzeiten")) return "Lernzeiten anpassen";
	return undefined;
};

const getPlanningHintTitle = (hint: string) => {
	if (hint.includes(MISSING_LEARNING_TIMES_HINT)) return "Lernzeiten fehlen";
	if (hint.includes("Lernzeiten")) return "Lernzeiten prüfen";
	return "Planung prüfen";
};

export function PlanningHintBanner({
	className,
	hint,
	onPressLearningTimes,
}: {
	className?: string;
	hint: string;
	onPressLearningTimes: () => void;
}) {
	const ctaLabel = getPlanningHintCtaLabel(hint);

	return (
		<WarningBanner
			className={className}
			title={getPlanningHintTitle(hint)}
			description={hint}
			ctaLabel={ctaLabel}
			onPressCta={ctaLabel ? onPressLearningTimes : undefined}
		/>
	);
}

export function MaterialCard({
	name,
	size,
	onRemove,
}: {
	name: string;
	size: number;
	onRemove: () => void;
}) {
	const { colors } = useDayovaTheme();
	const { shouldStackInlineContent } = useContentSizeLayout();

	return (
		<Surface
			className="mb-3 flex-row items-center rounded-[24px] px-4 py-4"
			variant="soft"
		>
			<View className="h-11 w-11 items-center justify-center rounded-full bg-primary/12">
				<Attachment size={21} color="#00BAFF" strokeWidth={2.2} />
			</View>
			<View className="ml-3 flex-1">
				<Text
					numberOfLines={shouldStackInlineContent ? undefined : 1}
					className="font-poppins font-semibold text-body-3 text-text"
				>
					{name}
				</Text>
				<Text className="mt-1 font-poppins text-body-4 text-text/50">
					{formatFileSize(size)}
				</Text>
			</View>
			<TouchableOpacity
				accessibilityHint="Entfernt dieses hochgeladene Material aus dem Lernplan."
				accessibilityLabel={`${name} entfernen`}
				accessibilityRole="button"
				activeOpacity={0.75}
				hitSlop={8}
				onPress={onRemove}
				className="h-9 w-9 items-center justify-center rounded-full bg-black/5"
			>
				<X size={16} color={colors.text} strokeWidth={2.3} />
			</TouchableOpacity>
		</Surface>
	);
}

type SessionCardProps =
	| {
			session: PlanSession;
			mode?: "screen";
			onEdit: () => void;
	  }
	| {
			session: PlanSession;
			testID?: string;
			mode: "artwork";
			onEdit?: never;
	  };

const sessionCardVisualByMode = {
	screen: {
		card: "rounded-[28px] px-5 py-5",
		date: "h-14 w-14",
		dateText: "text-body-2",
		edit: "h-11 w-11",
		editIconSize: 19,
		fixedTextScale: false,
		time: "text-body-4",
		title: "text-body-3",
		titleNumberOfLines: undefined,
	},
	artwork: {
		card: "h-[72px] rounded-[24px] px-4 py-2",
		date: "h-12 w-12",
		dateText: "text-body-3",
		edit: "h-9 w-9",
		editIconSize: 16,
		fixedTextScale: true,
		time: "text-body-5",
		title: "text-body-4",
		titleNumberOfLines: 2,
	},
} as const;

export function SessionCard(props: SessionCardProps) {
	const { session } = props;
	const mode = props.mode ?? "screen";
	const { colors } = useDayovaTheme();
	const { shouldStackInlineContent } = useContentSizeLayout();
	const visual = sessionCardVisualByMode[mode];
	const shouldStack = mode === "screen" && shouldStackInlineContent;
	const endTime = timeFromMinutes(
		minutesFromTime(session.startTime) + session.durationMinutes,
	);
	const sessionDate = parseDateKey(session.dateKey);
	const title = formatGermanUiText(session.title);

	const content = (
		<>
			<View
				className={cn(
					"items-center justify-center rounded-full bg-button-neutral",
					visual.date,
				)}
			>
				<Text
					allowFontScaling={!visual.fixedTextScale}
					className={cn(
						"font-poppins font-semibold text-background",
						visual.dateText,
					)}
				>
					{formatDayOfMonth(sessionDate)}
				</Text>
				<Text
					allowFontScaling={!visual.fixedTextScale}
					className="-mt-1 font-poppins font-semibold text-background text-body-5"
				>
					{formatShortWeekday(sessionDate)}
				</Text>
			</View>
			<View className={shouldStack ? "flex-1" : "flex-1 px-3"}>
				<Text
					allowFontScaling={!visual.fixedTextScale}
					numberOfLines={visual.titleNumberOfLines}
					className={cn("font-poppins font-semibold text-text", visual.title)}
				>
					{title}
				</Text>
				<Text
					allowFontScaling={!visual.fixedTextScale}
					className={cn("mt-1 font-poppins text-text/55", visual.time)}
				>
					{session.startTime} - {endTime}
				</Text>
			</View>
			<View
				className={cn(
					"items-center justify-center rounded-full border border-black/10",
					visual.edit,
					shouldStack && "self-end",
				)}
			>
				<PropertyEdit
					size={visual.editIconSize}
					color={colors.text}
					strokeWidth={1.5}
				/>
			</View>
		</>
	);
	const className = cn(
		visual.card,
		shouldStack ? "items-stretch gap-3" : "flex-row items-center",
	);

	if (props.mode === "artwork") {
		return (
			<Surface
				accessible={false}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				className={className}
				testID={props.testID}
				variant="soft"
				// Rounded artwork geometry uses the native continuous-corner treatment.
				style={{ borderCurve: "continuous" }}
			>
				{content}
			</Surface>
		);
	}

	return (
		<ActionSurface
			accessibilityHint="Öffnet die Bearbeitung für diesen Lerntag."
			accessibilityLabel={`${title}, ${session.dateLabel}, ${session.startTime} bis ${endTime} bearbeiten`}
			accessibilityRole="button"
			activeOpacity={0.88}
			onPress={props.onEdit}
			className={className}
			variant="soft"
		>
			{content}
		</ActionSurface>
	);
}

function SessionEditPill({
	value,
	icon,
	onPress,
	accessibilityLabel,
	className,
}: {
	value: string;
	icon: ReactNode;
	onPress: () => void;
	accessibilityLabel: string;
	className?: string;
}) {
	const { shouldStackInlineContent } = useContentSizeLayout();

	return (
		<FieldTrigger
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			activeOpacity={0.86}
			onPress={onPress}
			className={cn("min-h-[64px] rounded-[28px] px-5", className)}
			style={{
				boxShadow: "0 6px 13px rgba(0, 0, 0, 0.08)",
			}}
		>
			<Text
				className="flex-1 font-poppins text-body-2 text-text"
				numberOfLines={shouldStackInlineContent ? undefined : 1}
			>
				{value}
			</Text>
			<FieldAccessory>{icon}</FieldAccessory>
		</FieldTrigger>
	);
}

export function SessionEditForm({
	session,
	editDate,
	editStart,
	editEnd,
	editPhase,
	isSaving,
	onChangeDate,
	onChangeStart,
	onChangeEnd,
	onChangePhase,
	onRemove,
	onSave,
}: {
	session: PlanSession;
	editDate: Date;
	editStart: string;
	editEnd: string;
	editPhase: SessionPhase;
	isSaving: boolean;
	onChangeDate: () => void;
	onChangeStart: () => void;
	onChangeEnd: () => void;
	onChangePhase: (phase: SessionPhase) => void;
	onRemove: () => void;
	onSave: () => void;
}) {
	const [isPhaseMenuOpen, setIsPhaseMenuOpen] = useState(false);
	const { colors } = useDayovaTheme();
	const { shouldStackInlineContent } = useContentSizeLayout();

	return (
		<View className="flex-1">
			<Text className="font-poppins font-semibold text-body-2 text-text">
				{getSessionEditTitle({ ...session, phase: editPhase })}
			</Text>
			<Text className="mt-2 mb-7 font-poppins text-body-3 text-text/42">
				Passe deinen Lernplan so an, wie er für dich passt.
			</Text>

			<FieldLabel>Lerndatum</FieldLabel>
			<SessionEditPill
				accessibilityLabel="Lerndatum ändern"
				value={formatDate(editDate)}
				icon={<CalendarDays size={20} color="#697586" strokeWidth={2.1} />}
				onPress={onChangeDate}
			/>
			<View
				className={cn(
					"mt-5 mb-7 gap-3",
					!shouldStackInlineContent && "flex-row",
				)}
			>
				<View className="flex-1">
					<SessionEditPill
						accessibilityLabel="Startzeit ändern"
						value={editStart}
						icon={<Clock3 size={19} color="#697586" strokeWidth={2.1} />}
						onPress={onChangeStart}
						className="min-h-[64px] px-5"
					/>
				</View>
				<View className="flex-1">
					<SessionEditPill
						accessibilityLabel="Endzeit ändern"
						value={editEnd}
						icon={<Clock3 size={19} color="#697586" strokeWidth={2.1} />}
						onPress={onChangeEnd}
						className="min-h-[64px] px-5"
					/>
				</View>
			</View>

			<FieldLabel>Lernphase</FieldLabel>
			<View>
				<SessionEditPill
					accessibilityLabel="Lernphase ändern"
					value={getSessionPhaseLabel(editPhase)}
					icon={<ChevronDown size={20} color={colors.text} strokeWidth={2.1} />}
					onPress={() => setIsPhaseMenuOpen((value) => !value)}
				/>
				{isPhaseMenuOpen ? (
					<View className="mt-2 gap-2">
						{sessionPhaseOptions.map((phase) => (
							<TouchableOpacity
								key={phase}
								accessibilityLabel={`Lernphase ${getSessionPhaseLabel(phase)} auswählen`}
								accessibilityRole="button"
								accessibilityState={{ selected: phase === editPhase }}
								activeOpacity={0.86}
								onPress={() => {
									onChangePhase(phase);
									setIsPhaseMenuOpen(false);
								}}
								className="min-h-12 justify-center rounded-[24px] bg-card px-5 py-2"
								style={{
									borderWidth: phase === editPhase ? 1.5 : 1,
									borderColor:
										phase === editPhase ? "#00BAFF" : "rgba(17,24,39,0.04)",
								}}
							>
								<Text className="font-poppins text-body-3 text-text/70">
									{getSessionPhaseLabel(phase)}
								</Text>
							</TouchableOpacity>
						))}
					</View>
				) : null}
			</View>

			<View
				className={cn(
					"mt-auto gap-3 pt-8",
					!shouldStackInlineContent && "flex-row",
				)}
			>
				<Button
					variant="neutral"
					className={
						shouldStackInlineContent
							? "w-full shadow-none"
							: "flex-1 shadow-none"
					}
					onPress={onRemove}
				>
					<Text>Entfernen</Text>
				</Button>
				<Button
					accessibilityLabel={
						isSaving ? "Speichern, wird geladen" : "Speichern"
					}
					accessibilityLiveRegion={isSaving ? "polite" : undefined}
					accessibilityState={{ busy: isSaving, disabled: isSaving }}
					className={shouldStackInlineContent ? "w-full" : "flex-1"}
					onPress={onSave}
					disabled={isSaving}
				>
					{isSaving ? (
						<ActivityIndicator color="#FFFFFF" />
					) : (
						<Text>Speichern</Text>
					)}
				</Button>
			</View>
		</View>
	);
}
