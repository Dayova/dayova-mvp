import { useConvexAuth, useMutation } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { Keyboard, type LayoutChangeEvent, Platform, View } from "react-native";
import {
	type KeyboardAwareScrollViewRef,
	KeyboardStickyView,
} from "react-native-keyboard-controller";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import {
	ExamDateSelector,
	ExamFlowHeader,
	ExamTypePicker,
} from "~/components/entry/exam-flow";
import { BackButton, Button } from "~/components/ui/button";
import type { DateTimePickerEvent } from "~/components/ui/date-time-picker-sheet";
import { DateTimePickerSheet } from "~/components/ui/date-time-picker-sheet";
import {
	Field,
	FieldAccessory,
	FieldControl,
	FieldLabel,
	FieldTrigger,
} from "~/components/ui/field";
import {
	BookOpen,
	Calculator,
	CalendarDays,
	Chemistry,
	ChevronDown,
	Clock3,
	Code,
	Dna,
	Earth,
	Football,
	Language,
	Maps,
	Mic,
	MusicNote,
	PaintBrush,
	Pencil,
	TimeManagement,
} from "~/components/ui/icon";
import { shouldUseKeyboardStickyActions } from "~/components/ui/keyboard-safe-scroll";
import { KeyboardSafeScrollView } from "~/components/ui/keyboard-safe-scroll-view";
import { SelectSheet } from "~/components/ui/select-sheet";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { useValidationAnalytics } from "~/lib/analytics";
import { definedAnalyticsProperties } from "~/lib/analytics-core";
import { getDayKey, parseDayKey, startOfLocalDay } from "~/lib/day-key";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import {
	constrainEndTimeForStart,
	getDurationBetweenTimes,
	MAX_EXAM_DURATION_MINUTES,
	MIN_EXAM_DURATION_MINUTES,
	shiftEndTimeForStartChange,
} from "~/lib/entry-time";
import { goBackOrReplace, useBackIntent } from "~/lib/navigation";
import { ROUTES } from "~/lib/routes";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

type EntryType = "homework" | "exam";
type EntryStep = "basics" | "planning" | "examType" | "examDetails";
type PickerTarget =
	| "dueDate"
	| "plannedDate"
	| "plannedTime"
	| "plannedEndTime";
type SelectTarget = "subject";

const SUBJECT_OPTIONS = [
	"Mathematik",
	"Deutsch",
	"Englisch",
	"Biologie",
	"Chemie",
	"Physik",
	"Geschichte",
	"Erdkunde",
	"Sozialkunde",
	"Informatik",
	"Kunst",
	"Musik",
	"Sport",
];

const KEYBOARD_DISMISS_FALLBACK_MS = 280;
const SELECTED_OPTION_ICON_COLOR = DAYOVA_DESIGN_SYSTEM.colors.primary;
const EXAM_DURATION_OPTIONS = {
	minimumMinutes: MIN_EXAM_DURATION_MINUTES,
	maximumMinutes: MAX_EXAM_DURATION_MINUTES,
} as const;

const subjectIconByOption = {
	Mathematik: Calculator,
	Deutsch: Pencil,
	Englisch: Language,
	Biologie: Dna,
	Chemie: Chemistry,
	Physik: Earth,
	Geschichte: TimeManagement,
	Erdkunde: Maps,
	Sozialkunde: Mic,
	Informatik: Code,
	Kunst: PaintBrush,
	Musik: MusicNote,
	Sport: Football,
} satisfies Record<(typeof SUBJECT_OPTIONS)[number], typeof BookOpen>;

const parseDateKey = (value?: string) => {
	return parseDayKey(value) ?? startOfLocalDay(new Date());
};

const formatDate = (date: Date) =>
	new Intl.DateTimeFormat("de-DE", {
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(date);

const formatTime = (date: Date) =>
	new Intl.DateTimeFormat("de-DE", {
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);

const formatCompactDate = (date: Date) =>
	new Intl.DateTimeFormat("de-DE", {
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(date);

const formatDuration = (durationMinutes: number) => {
	if (durationMinutes < 60) return `${durationMinutes} Min.`;

	const hours = Math.floor(durationMinutes / 60);
	const minutes = durationMinutes % 60;
	return minutes > 0 ? `${hours} Std. ${minutes} Min.` : `${hours} Std.`;
};

const homeworkSuccessPath = ({
	dayKey,
	completionDateKey,
	completionDateLabel,
	completionTime,
}: {
	dayKey: string;
	completionDateKey: string;
	completionDateLabel: string;
	completionTime: string;
}) => {
	const query = [
		["dayKey", dayKey],
		["completionDateKey", completionDateKey],
		["completionDateLabel", completionDateLabel],
		["completionTime", completionTime],
	]
		.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
		.join("&");

	return `/entry/success?${query}` as const;
};

function HomeworkPillField({
	label,
	value,
	placeholder,
	icon,
	onPress,
	className,
}: {
	label?: string;
	value?: string;
	placeholder?: string;
	icon?: ReactNode;
	onPress?: () => void;
	className?: string;
}) {
	const content = (
		<>
			<Text
				className="flex-1 font-poppins text-body-2 text-secondary-text"
				numberOfLines={1}
			>
				{value || placeholder}
			</Text>
			{icon ? <FieldAccessory>{icon}</FieldAccessory> : null}
		</>
	);

	return (
		<Field className="mb-5">
			{label ? <FieldLabel>{label}</FieldLabel> : null}
			{onPress ? (
				<FieldTrigger
					activeOpacity={0.86}
					onPress={onPress}
					className={cn("min-h-16 rounded-input px-5", className)}
				>
					{content}
				</FieldTrigger>
			) : (
				<FieldControl className={cn("min-h-16 rounded-input px-5", className)}>
					{content}
				</FieldControl>
			)}
		</Field>
	);
}

function HomeworkScreenHeader({
	title,
	onBack,
}: {
	title: string;
	onBack: () => void;
}) {
	return (
		<View className="mb-7 flex-row items-center justify-between">
			<BackButton onPress={onBack} />
			<Text className="font-poppins font-semibold text-body-2 text-text">
				{title}
			</Text>
			<View className="w-12" />
		</View>
	);
}

function StickyActionFooter({
	bottomInset,
	children,
}: {
	bottomInset: number;
	children: ReactNode;
}) {
	return (
		<View
			className="px-6"
			// The bottom padding must include the device's runtime safe-area inset.
			style={{ paddingBottom: Math.max(bottomInset + 10, 24) }}
		>
			{children}
		</View>
	);
}

export default function NewEntryScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { colors } = useDayovaTheme();
	const fieldIconColor = colors.secondaryText;
	const fieldTextColor = colors.text;
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const createDayEntry = useMutation(api.dayEntries.create);
	const { capture } = useValidationAnalytics();
	const params = useLocalSearchParams<{
		type?: string;
		dayKey?: string;
		dayLabel?: string;
	}>();
	const entryType: EntryType = params.type === "exam" ? "exam" : "homework";
	const isHomework = entryType === "homework";
	const [initialDate] = useState(() => parseDateKey(params.dayKey));

	const [step, setStep] = useState<EntryStep>("basics");
	const [subject, setSubject] = useState("");
	const [examTypeLabel, setExamTypeLabel] = useState("");
	const [note, setNote] = useState("");
	const [dueDate, setDueDate] = useState(initialDate);
	const [plannedDate, setPlannedDate] = useState(initialDate);
	const [plannedTime, setPlannedTime] = useState(() => {
		const next = new Date();
		next.setHours(16, 0, 0, 0);
		return next;
	});
	const [plannedEndTime, setPlannedEndTime] = useState(() => {
		const next = new Date();
		next.setHours(16, 30, 0, 0);
		return next;
	});
	const [isCreating, setIsCreating] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
	const [selectTarget, setSelectTarget] = useState<SelectTarget | null>(null);
	const scrollViewRef = useRef<KeyboardAwareScrollViewRef | null>(null);
	const noteInputOffsetY = useRef(0);
	const keyboardHideSubscriptionRef = useRef<ReturnType<
		typeof Keyboard.addListener
	> | null>(null);
	const keyboardDismissFallbackRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);
	const keyboardDismissFrameRef = useRef<ReturnType<
		typeof requestAnimationFrame
	> | null>(null);

	const trimmedSubject = subject.trim();
	const trimmedExamType = examTypeLabel.trim();
	const canContinueFromBasics = trimmedSubject.length > 0;
	const scheduledDurationMinutes = getDurationBetweenTimes(
		plannedTime,
		plannedEndTime,
		isHomework ? undefined : EXAM_DURATION_OPTIONS,
	);
	const canCreateHomework = trimmedSubject.length > 0;
	const canCreateExam = trimmedSubject.length > 0 && trimmedExamType.length > 0;
	const canWriteEntries = Boolean(user && isConvexAuthenticated);
	const examStepNumber = step === "basics" ? 1 : step === "examType" ? 2 : 3;

	const clearPendingModalOpen = useCallback(() => {
		keyboardHideSubscriptionRef.current?.remove();
		keyboardHideSubscriptionRef.current = null;

		if (keyboardDismissFallbackRef.current) {
			clearTimeout(keyboardDismissFallbackRef.current);
			keyboardDismissFallbackRef.current = null;
		}

		if (keyboardDismissFrameRef.current) {
			cancelAnimationFrame(keyboardDismissFrameRef.current);
			keyboardDismissFrameRef.current = null;
		}
	}, []);

	useEffect(() => clearPendingModalOpen, [clearPendingModalOpen]);

	const openAfterKeyboardDismiss = useCallback(
		(open: () => void) => {
			clearPendingModalOpen();
			const isKeyboardVisible = Keyboard.isVisible();

			if (!isKeyboardVisible) {
				Keyboard.dismiss();
				open();
				return;
			}

			let didOpen = false;
			const finishOpen = () => {
				if (didOpen) return;
				didOpen = true;
				clearPendingModalOpen();
				keyboardDismissFrameRef.current = requestAnimationFrame(() => {
					keyboardDismissFrameRef.current = null;
					open();
				});
			};

			keyboardHideSubscriptionRef.current = Keyboard.addListener(
				"keyboardDidHide",
				finishOpen,
			);
			keyboardDismissFallbackRef.current = setTimeout(
				finishOpen,
				KEYBOARD_DISMISS_FALLBACK_MS,
			);
			Keyboard.dismiss();
		},
		[clearPendingModalOpen],
	);

	const openPicker = useCallback(
		(target: PickerTarget) => {
			openAfterKeyboardDismiss(() => setPickerTarget(target));
		},
		[openAfterKeyboardDismiss],
	);

	const openSelect = useCallback(
		(target: SelectTarget) => {
			openAfterKeyboardDismiss(() => setSelectTarget(target));
		},
		[openAfterKeyboardDismiss],
	);

	const closePicker = () => {
		clearPendingModalOpen();
		setPickerTarget(null);
	};
	const closeSelect = () => {
		clearPendingModalOpen();
		setSelectTarget(null);
	};

	const handlePickerChange = (
		event: DateTimePickerEvent,
		selectedDate?: Date,
	) => {
		if (Platform.OS === "android") closePicker();
		if (event.type === "dismissed" || !selectedDate || !pickerTarget) return;

		if (pickerTarget === "dueDate") setDueDate(startOfLocalDay(selectedDate));
		if (pickerTarget === "plannedDate")
			setPlannedDate(startOfLocalDay(selectedDate));
		if (pickerTarget === "plannedTime") {
			const next = new Date(plannedTime);
			next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
			setPlannedTime(next);
			setPlannedEndTime(
				shiftEndTimeForStartChange({
					previousStart: plannedTime,
					previousEnd: plannedEndTime,
					nextStart: next,
					...(isHomework ? {} : EXAM_DURATION_OPTIONS),
				}),
			);
		}
		if (pickerTarget === "plannedEndTime") {
			const next = new Date(plannedEndTime);
			next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
			setPlannedEndTime(
				constrainEndTimeForStart({
					start: plannedTime,
					end: next,
					...(isHomework ? {} : EXAM_DURATION_OPTIONS),
				}),
			);
		}
	};

	const createEntry = async ({
		redirectToHome = true,
	}: {
		redirectToHome?: boolean;
	} = {}) => {
		if (isHomework && !canCreateHomework) return;
		if (!isHomework && !canCreateExam) return;
		const resolvedDurationMinutes = scheduledDurationMinutes;
		if (!canWriteEntries || isCreating) return;

		const nextDayKey = getDayKey(plannedDate);
		const trimmedNote = note.trim();
		const entryTitle = isHomework
			? `${trimmedSubject} Hausaufgabe`
			: `${trimmedSubject} ${trimmedExamType}`;
		let createdEntryId: Id<"dayEntries"> | null = null;

		try {
			setIsCreating(true);
			setErrorMessage(null);
			createdEntryId = await createDayEntry({
				dayKey: nextDayKey,
				title: entryTitle,
				time: formatTime(plannedTime),
				kind: isHomework ? "Hausaufgabe" : "Leistungskontrolle",
				...(trimmedNote ? { notes: trimmedNote } : {}),
				...(isHomework
					? {
							dueDateKey: getDayKey(dueDate),
							dueDateLabel: formatDate(dueDate),
						}
					: {}),
				plannedDateLabel: formatDate(plannedDate),
				durationMinutes: resolvedDurationMinutes,
				...(!isHomework ? { examTypeLabel: trimmedExamType } : {}),
			});
			void capture(
				isHomework ? "homework_created" : "exam_created",
				definedAnalyticsProperties({
					day_entry_id: createdEntryId,
					subject: trimmedSubject,
					planned_day_key: nextDayKey,
					duration_minutes: resolvedDurationMinutes,
					due_day_key: isHomework ? getDayKey(dueDate) : undefined,
					exam_type_label: isHomework ? undefined : trimmedExamType,
				}),
			);
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "Der Eintrag konnte nicht gespeichert werden."),
			);
			return;
		} finally {
			setIsCreating(false);
		}

		if (isHomework) {
			router.replace(
				homeworkSuccessPath({
					dayKey: nextDayKey,
					completionDateKey: nextDayKey,
					completionDateLabel: formatCompactDate(plannedDate),
					completionTime: formatTime(plannedTime),
				}),
			);
			return;
		}

		const result = {
			createdDayKey: nextDayKey,
			createdEntryId,
			entryTitle,
		};
		if (redirectToHome) {
			router.replace(`/home?dayKey=${encodeURIComponent(nextDayKey)}`);
		}
		return result;
	};

	const createLearningPlan = async () => {
		if (!canCreateExam || isCreating || !canWriteEntries) return;

		const createdExam = await createEntry({ redirectToHome: false });
		if (!createdExam?.createdEntryId) return;

		const query = [
			["examDayEntryId", createdExam.createdEntryId],
			["subject", trimmedSubject],
			["examTypeLabel", trimmedExamType],
			["examDateKey", getDayKey(plannedDate)],
			["examDateLabel", formatDate(plannedDate)],
			["examTime", formatTime(plannedTime)],
			["durationMinutes", `${scheduledDurationMinutes}`],
		]
			.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
			.join("&");
		router.push(`${ROUTES.createLearningPlan}?${query}`);
	};

	const handleBack = useCallback(() => {
		if (selectTarget) {
			setSelectTarget(null);
			return true;
		}

		if (pickerTarget) {
			setPickerTarget(null);
			return true;
		}

		if (step === "planning" || step === "examType") {
			setStep("basics");
			return true;
		}

		if (step === "examDetails") {
			setStep("examType");
			return true;
		}

		goBackOrReplace(router, "/home");
		return true;
	}, [pickerTarget, router, selectTarget, step]);

	useBackIntent(
		Boolean(selectTarget || pickerTarget || step !== "basics"),
		handleBack,
	);

	const scrollToFocusedField = useCallback((offsetY: number) => {
		requestAnimationFrame(() => {
			scrollViewRef.current?.scrollTo({
				y: Math.max(0, offsetY - 36),
				animated: true,
			});
		});
	}, []);

	const handleNoteInputFocus = useCallback(() => {
		scrollToFocusedField(noteInputOffsetY.current);
	}, [scrollToFocusedField]);

	const handleNoteInputLayout = useCallback((event: LayoutChangeEvent) => {
		noteInputOffsetY.current = event.nativeEvent.layout.y;
	}, []);

	const renderPicker = () => {
		if (!pickerTarget) return null;

		const mode =
			pickerTarget === "plannedTime" || pickerTarget === "plannedEndTime"
				? "time"
				: "date";
		const value =
			pickerTarget === "dueDate"
				? dueDate
				: pickerTarget === "plannedTime"
					? plannedTime
					: pickerTarget === "plannedEndTime"
						? plannedEndTime
						: plannedDate;

		return (
			<DateTimePickerSheet
				visible
				value={value}
				mode={mode}
				onChange={handlePickerChange}
				onClose={closePicker}
			/>
		);
	};

	const renderSelectSheet = () => {
		if (!selectTarget) return null;

		return (
			<SelectSheet
				visible
				title="Schulfach auswählen"
				options={SUBJECT_OPTIONS}
				selectedValue={subject}
				onClose={closeSelect}
				onSelect={setSubject}
				renderOptionIcon={(option, isSelected) => {
					const SubjectIcon =
						subjectIconByOption[option as keyof typeof subjectIconByOption] ??
						BookOpen;

					return (
						<SubjectIcon
							size={19}
							color={isSelected ? SELECTED_OPTION_ICON_COLOR : fieldIconColor}
							strokeWidth={2}
						/>
					);
				}}
			/>
		);
	};

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ gestureEnabled: true }} />
			<ThemedStatusBar />
			<KeyboardSafeScrollView
				ref={scrollViewRef}
				className="flex-1"
				bottomOffset={128}
				contentContainerStyle={{
					paddingHorizontal: 32,
					paddingTop: isHomework ? Math.max(insets.top + 28, 58) : 80,
					paddingBottom: 168,
				}}
			>
				{isHomework ? (
					step === "basics" ? (
						<>
							<HomeworkScreenHeader title="Abgabe" onBack={handleBack} />
							<View className="mb-7">
								<Text className="font-poppins font-semibold text-body-3 text-text">
									Hausaufgabe eintragen
								</Text>
								<Text className="mt-2 font-poppins text-body-3 text-secondary-text">
									Trage zuerst Fälligkeit, Fach und Notiz ein.
								</Text>
							</View>

							<HomeworkPillField
								label="Fälligkeitsdatum"
								value={formatCompactDate(dueDate)}
								icon={
									<CalendarDays
										size={20}
										color={fieldIconColor}
										strokeWidth={2.1}
									/>
								}
								onPress={() => openPicker("dueDate")}
							/>

							<Field>
								<FieldLabel>Schulfach</FieldLabel>
								<FieldTrigger
									activeOpacity={0.86}
									onPress={() => openSelect("subject")}
									className="min-h-16 rounded-input px-5"
								>
									<Text
										className={cn(
											"flex-1 font-poppins text-body-2",
											subject ? "text-text" : "text-secondary-text",
										)}
										numberOfLines={1}
									>
										{subject || "Wähle das Fach aus"}
									</Text>
									<FieldAccessory>
										<ChevronDown
											size={20}
											color={fieldTextColor}
											strokeWidth={2.1}
										/>
									</FieldAccessory>
								</FieldTrigger>
							</Field>

							<Field className="mb-8" onLayout={handleNoteInputLayout}>
								<FieldLabel>Notizen</FieldLabel>
								<FieldControl className="min-h-40 items-start rounded-input px-5 pt-4 pb-4">
									<Textarea
										value={note}
										onChangeText={setNote}
										onFocus={handleNoteInputFocus}
										placeholder="Kurze Notiz hinzufügen"
									/>
								</FieldControl>
							</Field>
						</>
					) : (
						<>
							<HomeworkScreenHeader title="Erledigen" onBack={handleBack} />
							<View className="mb-5">
								<Text className="font-poppins font-semibold text-body-3 text-text">
									Hausaufgabe eintragen
								</Text>
								<Text className="mt-2 font-poppins text-body-3 text-secondary-text">
									Plane jetzt, wann du die Hausaufgabe erledigst.
								</Text>
							</View>

							<HomeworkPillField
								label="Erledigungsdatum"
								value={formatCompactDate(plannedDate)}
								icon={
									<CalendarDays
										size={20}
										color={fieldIconColor}
										strokeWidth={2.1}
									/>
								}
								onPress={() => openPicker("plannedDate")}
							/>

							<View className="mb-5 flex-row gap-3">
								<View className="flex-1">
									<HomeworkPillField
										value={formatTime(plannedTime)}
										placeholder="Von"
										icon={
											<Clock3
												size={19}
												color={fieldIconColor}
												strokeWidth={2.1}
											/>
										}
										onPress={() => openPicker("plannedTime")}
										className="min-h-16 px-5"
									/>
								</View>
								<View className="flex-1">
									<HomeworkPillField
										value={formatTime(plannedEndTime)}
										placeholder="Bis"
										icon={
											<Clock3
												size={19}
												color={fieldIconColor}
												strokeWidth={2.1}
											/>
										}
										onPress={() => openPicker("plannedEndTime")}
										className="min-h-16 px-5"
									/>
								</View>
							</View>
						</>
					)
				) : (
					<>
						<ExamFlowHeader currentStep={examStepNumber} onBack={handleBack} />
						<Animated.View key={step} entering={FadeIn.duration(220)}>
							{step === "basics" ? (
								<>
									<View className="mb-7 gap-2">
										<Text className="font-poppins font-semibold text-heading-2 text-text">
											Wann findet die Prüfung statt?
										</Text>
										<Text className="font-poppins text-body-3 text-secondary-text">
											Wähle den Prüfungstag und die genaue Uhrzeit.
										</Text>
									</View>

									<View className="gap-3">
										<Text className="font-poppins text-body-4 text-text">
											Prüfungstag
										</Text>
										<ExamDateSelector
											selectedDate={plannedDate}
											onSelect={setPlannedDate}
										/>
									</View>

									<Text className="font-poppins text-body-4 text-text">
										Uhrzeit
									</Text>
									<View className="flex-row gap-3">
										<View className="flex-1">
											<HomeworkPillField
												value={formatTime(plannedTime)}
												placeholder="Von"
												icon={
													<Clock3
														size={19}
														color={fieldIconColor}
														strokeWidth={2.1}
													/>
												}
												onPress={() => openPicker("plannedTime")}
												className="min-h-16 px-5"
											/>
										</View>
										<View className="flex-1">
											<HomeworkPillField
												value={formatTime(plannedEndTime)}
												placeholder="Bis"
												icon={
													<Clock3
														size={19}
														color={fieldIconColor}
														strokeWidth={2.1}
													/>
												}
												onPress={() => openPicker("plannedEndTime")}
												className="min-h-16 px-5"
											/>
										</View>
									</View>
									<View className="rounded-[24px] bg-primary/10 px-5 py-4">
										<Text className="font-poppins font-semibold text-body-3 text-primary">
											Dauer: {formatDuration(scheduledDurationMinutes)}
										</Text>
										<Text className="mt-1 font-poppins text-body-4 text-secondary-text">
											Möglich sind 3 Minuten bis 6 Stunden.
										</Text>
									</View>
								</>
							) : step === "examType" ? (
								<>
									<View className="mb-7 gap-2">
										<Text className="font-poppins font-semibold text-heading-2 text-text">
											Welche Art von Prüfung ist es?
										</Text>
										<Text className="font-poppins text-body-3 text-secondary-text">
											Wähle eine Prüfungsart oder trage eine eigene ein.
										</Text>
									</View>
									<ExamTypePicker
										selectedValue={examTypeLabel}
										onSelect={setExamTypeLabel}
									/>
								</>
							) : (
								<>
									<View className="mb-7 gap-2">
										<Text className="font-poppins font-semibold text-heading-2 text-text">
											Noch die letzten Details
										</Text>
										<Text className="font-poppins text-body-3 text-secondary-text">
											Wähle das Fach. Eine Notiz ist optional.
										</Text>
									</View>

									<Field>
										<FieldLabel>Schulfach</FieldLabel>
										<FieldTrigger
											activeOpacity={0.86}
											onPress={() => openSelect("subject")}
											className="min-h-16 rounded-input px-5"
										>
											<Text
												className={cn(
													"flex-1 font-poppins text-body-2",
													subject ? "text-text" : "text-secondary-text",
												)}
												numberOfLines={1}
											>
												{subject || "Wähle das Fach aus"}
											</Text>
											<FieldAccessory>
												<ChevronDown
													size={20}
													color={fieldTextColor}
													strokeWidth={2.1}
												/>
											</FieldAccessory>
										</FieldTrigger>
									</Field>

									<Field className="mb-8" onLayout={handleNoteInputLayout}>
										<FieldLabel>Notiz (optional)</FieldLabel>
										<FieldControl className="min-h-40 items-start rounded-input px-5 pt-4 pb-4">
											<Textarea
												value={note}
												onChangeText={setNote}
												onFocus={handleNoteInputFocus}
												placeholder="Zum Beispiel Raum oder Hilfsmittel"
											/>
										</FieldControl>
									</Field>
								</>
							)}
						</Animated.View>
					</>
				)}
			</KeyboardSafeScrollView>
			<KeyboardStickyView enabled={shouldUseKeyboardStickyActions(Platform.OS)}>
				{isHomework ? (
					<StickyActionFooter bottomInset={insets.bottom}>
						{errorMessage ? (
							<Text
								accessibilityRole="alert"
								accessibilityLiveRegion="polite"
								className="mb-3 text-center font-poppins text-body-4 text-destructive"
							>
								{errorMessage}
							</Text>
						) : null}
						<Button
							className="w-full"
							disabled={
								step === "basics"
									? !canContinueFromBasics
									: isCreating || !canWriteEntries
							}
							onPress={() => {
								if (step === "basics") {
									setStep("planning");
									return;
								}
								void createEntry();
							}}
						>
							<Text>Weiter</Text>
						</Button>
					</StickyActionFooter>
				) : step === "examDetails" ? (
					<StickyActionFooter bottomInset={insets.bottom}>
						{errorMessage ? (
							<Text
								accessibilityRole="alert"
								accessibilityLiveRegion="polite"
								className="mb-3 text-center font-poppins text-body-4 text-destructive"
							>
								{errorMessage}
							</Text>
						) : null}
						<View className="flex-row gap-3">
							<Button
								className="flex-1"
								variant="neutral"
								disabled={!canCreateExam || isCreating || !canWriteEntries}
								onPress={() => {
									void createEntry();
								}}
							>
								<Text>Eintragen</Text>
							</Button>
							<Button
								className="flex-1"
								disabled={!canCreateExam || isCreating || !canWriteEntries}
								onPress={() => {
									void createLearningPlan();
								}}
							>
								<Text>Lernplan</Text>
							</Button>
						</View>
					</StickyActionFooter>
				) : (
					<StickyActionFooter bottomInset={insets.bottom}>
						<Button
							className="w-full"
							disabled={step === "examType" && !trimmedExamType}
							onPress={() => {
								setStep(step === "basics" ? "examType" : "examDetails");
							}}
						>
							<Text>Weiter</Text>
						</Button>
					</StickyActionFooter>
				)}
			</KeyboardStickyView>
			{renderPicker()}
			{renderSelectSheet()}
		</View>
	);
}
