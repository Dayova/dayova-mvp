import { type ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	type SharedValue,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";
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
import { ActionSurface, Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { WarningBanner } from "~/components/ui/warning-banner";
import type {
	PlanSession,
	SessionPhase,
} from "~/features/learning-plans/types";
import {
	ANALYSIS_ORBIT_CENTER,
	ANALYSIS_ORBIT_LOADER_SIZE,
	type AnalysisOrbitPetal,
	ANALYSIS_ORBIT_PETAL_SIZE,
	ANALYSIS_ORBIT_PETALS,
	getAnalysisOrbitPetalPosition,
} from "~/features/learning-plans/analysis-orbit-loader";
import {
	formatDate,
	formatDayOfMonth,
	formatShortWeekday,
	minutesFromTime,
	parseDateKey,
	timeFromMinutes,
} from "~/features/learning-plans/utils";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { formatFileSize } from "~/lib/upload-policy";

const phaseEditCopy: Record<
	SessionPhase,
	{ actionLabel: string; fieldLabel: string }
> = {
	theory: { actionLabel: "Lernen", fieldLabel: "Theorie" },
	practice: { actionLabel: "Üben", fieldLabel: "Üben" },
	rehearsal: { actionLabel: "Testmodus", fieldLabel: "Testmodus" },
};

const getSessionEditTitle = (session: PlanSession) =>
	`${session.sortOrder + 1}. ${phaseEditCopy[session.phase].actionLabel} bearbeiten`;

const getSessionPhaseLabel = (phase: SessionPhase) =>
	phaseEditCopy[phase].fieldLabel;

const sessionPhaseOptions: SessionPhase[] = ["theory", "practice", "rehearsal"];

const ORBIT_COLLAPSE_DURATION = 2400;
const ORBIT_EXPAND_DURATION = 2200;
const ORBIT_CYCLE_DURATION = 5000;
const ORBIT_REST_DURATION =
	ORBIT_CYCLE_DURATION - ORBIT_COLLAPSE_DURATION - ORBIT_EXPAND_DURATION;

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
	if (hint.includes("Keine Lernzeiten hinterlegt"))
		return "Lernzeiten eintragen";
	if (hint.includes("Lernzeiten")) return "Lernzeiten anpassen";
	return undefined;
};

const getPlanningHintTitle = (hint: string) => {
	if (hint.includes("Keine Lernzeiten hinterlegt")) return "Lernzeiten fehlen";
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
					numberOfLines={1}
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
				<X size={16} color="#1A1A1A" strokeWidth={2.3} />
			</TouchableOpacity>
		</Surface>
	);
}

export function SessionCard({
	session,
	onEdit,
}: {
	session: PlanSession;
	onEdit: () => void;
}) {
	const endTime = timeFromMinutes(
		minutesFromTime(session.startTime) + session.durationMinutes,
	);
	const sessionDate = parseDateKey(session.dateKey);
	const title = formatGermanUiText(session.title);

	return (
		<ActionSurface
			accessibilityHint="Öffnet die Bearbeitung für diesen Lerntag."
			accessibilityLabel={`${title}, ${session.dateLabel}, ${session.startTime} bis ${endTime} bearbeiten`}
			accessibilityRole="button"
			activeOpacity={0.88}
			onPress={onEdit}
			className="flex-row items-center rounded-[28px] px-5 py-5"
			variant="soft"
		>
			<View className="h-14 w-14 items-center justify-center rounded-full bg-text">
				<Text className="font-poppins font-semibold text-body-2 text-white">
					{formatDayOfMonth(sessionDate)}
				</Text>
				<Text className="-mt-1 font-poppins font-semibold text-body-5 text-white">
					{formatShortWeekday(sessionDate)}
				</Text>
			</View>
			<View className="flex-1 px-3">
				<Text className="font-poppins font-semibold text-body-3 text-text">
					{title}
				</Text>
				<Text className="mt-1 font-poppins text-body-4 text-text/55">
					{session.startTime} - {endTime}
				</Text>
			</View>
			<View className="h-11 w-11 items-center justify-center rounded-full border border-black/10">
				<PropertyEdit size={19} color="#1A1A1A" strokeWidth={1.5} />
			</View>
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
	return (
		<FieldTrigger
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			activeOpacity={0.86}
			onPress={onPress}
			className={`min-h-[64px] rounded-[28px] px-5 ${className ?? ""}`}
			style={{
				boxShadow: "0 6px 13px rgba(0, 0, 0, 0.08)",
			}}
		>
			<Text
				className="flex-1 font-poppins text-body-2 text-text"
				numberOfLines={1}
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
			<View className="mt-5 mb-7 flex-row gap-3">
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
					icon={<ChevronDown size={20} color="#1A1A1A" strokeWidth={2.1} />}
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
								className="h-12 justify-center rounded-[24px] bg-card px-5"
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

			<View className="mt-auto flex-row gap-3 pt-8">
				<Button
					variant="neutral"
					className="flex-1 shadow-none"
					onPress={onRemove}
				>
					<Text className="text-text">Entfernen</Text>
				</Button>
				<Button
					accessibilityLabel={
						isSaving ? "Speichern, wird geladen" : "Speichern"
					}
					accessibilityLiveRegion={isSaving ? "polite" : undefined}
					accessibilityState={{ busy: isSaving, disabled: isSaving }}
					className="flex-1"
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

function AnalysisOrbitPetalCircle({
	petal,
	foldProgress,
}: {
	petal: AnalysisOrbitPetal;
	foldProgress: SharedValue<number>;
}) {
	const petalStyle = useAnimatedStyle(() => {
		const position = getAnalysisOrbitPetalPosition(petal, foldProgress.get());
		return {
			transform: [
				{ translateX: position.cx - ANALYSIS_ORBIT_CENTER },
				{ translateY: position.cy - ANALYSIS_ORBIT_CENTER },
			],
		};
	});

	return (
		<Animated.View
			style={[
				{
					position: "absolute",
					left: ANALYSIS_ORBIT_CENTER - ANALYSIS_ORBIT_PETAL_SIZE / 2,
					top: ANALYSIS_ORBIT_CENTER - ANALYSIS_ORBIT_PETAL_SIZE / 2,
					height: ANALYSIS_ORBIT_PETAL_SIZE,
					width: ANALYSIS_ORBIT_PETAL_SIZE,
					borderRadius: ANALYSIS_ORBIT_PETAL_SIZE / 2,
					backgroundColor: "rgba(58, 123, 255, 0.55)",
				},
				petalStyle,
			]}
		/>
	);
}

export function AnalysisOrbitLoader() {
	const foldProgress = useSharedValue(1);
	const flowerRotation = useSharedValue(0);
	const reduceMotion = useReducedMotion();

	useEffect(() => {
		if (reduceMotion) {
			flowerRotation.set(0);
			foldProgress.set(1);
			return;
		}

		flowerRotation.set(
			withRepeat(
				withSequence(
					withTiming(40, {
						duration: ORBIT_COLLAPSE_DURATION,
						easing: Easing.inOut(Easing.cubic),
					}),
					withDelay(
						ORBIT_EXPAND_DURATION + ORBIT_REST_DURATION,
						withTiming(0, { duration: 0 }),
					),
				),
				-1,
			),
		);
		foldProgress.set(
			withRepeat(
				withSequence(
					withTiming(0, {
						duration: ORBIT_COLLAPSE_DURATION,
						easing: Easing.inOut(Easing.cubic),
					}),
					withTiming(1, {
						duration: ORBIT_EXPAND_DURATION,
						easing: Easing.out(Easing.cubic),
					}),
					withDelay(ORBIT_REST_DURATION, withTiming(1, { duration: 0 })),
				),
				-1,
			),
		);

		return () => {
			cancelAnimation(flowerRotation);
			cancelAnimation(foldProgress);
		};
	}, [flowerRotation, foldProgress, reduceMotion]);

	const flowerStyle = useAnimatedStyle(() => {
		return {
			transform: [{ rotate: `${flowerRotation.get()}deg` }],
		};
	});

	return (
		<View
			className="mb-12 items-center justify-center"
			style={{
				height: ANALYSIS_ORBIT_LOADER_SIZE,
				width: ANALYSIS_ORBIT_LOADER_SIZE,
			}}
		>
			<Animated.View
				className="h-full w-full"
				style={flowerStyle}
			>
				{ANALYSIS_ORBIT_PETALS.map((petal) => (
					<AnalysisOrbitPetalCircle
						key={petal.id}
						petal={petal}
						foldProgress={foldProgress}
					/>
				))}
			</Animated.View>
		</View>
	);
}
