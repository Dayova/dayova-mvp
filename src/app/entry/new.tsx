import { useConvexAuth, useMutation } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
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
	ClipboardList,
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
import { useAuth } from "~/context/AuthContext";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { useValidationAnalytics } from "~/lib/analytics";
import { getDayKey, parseDayKey, startOfLocalDay } from "~/lib/day-key";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import {
	getDurationBetweenTimes,
	shiftEndTimeForStartChange,
} from "~/lib/entry-time";
import { goBackOrReplace, useBackIntent } from "~/lib/navigation";
import { ROUTES } from "~/lib/routes";
import { cn } from "~/lib/utils";

type EntryType = "homework" | "exam";
type EntryStep = "basics" | "planning";
type PickerTarget =
	| "dueDate"
	| "plannedDate"
	| "plannedTime"
	| "plannedEndTime";
type SelectTarget = "subject" | "examType";

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

const EXAM_TYPE_OPTIONS = [
	"Test",
	"Kurzkontrolle",
	"Leistungskontrolle",
	"Klassenarbeit",
	"Klausur",
	"Mündliche Prüfung",
	"Präsentation",
];

const KEYBOARD_DISMISS_FALLBACK_MS = 280;
const FIELD_ICON_COLOR = DAYOVA_DESIGN_SYSTEM.colors.secondaryText;
const FIELD_TEXT_COLOR = DAYOVA_DESIGN_SYSTEM.colors.text;
const SELECTED_OPTION_ICON_COLOR = DAYOVA_DESIGN_SYSTEM.colors.primary;

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

export default function NewEntryScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { user } = useAuth();
	const { capture } = useValidationAnalytics();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const createDayEntry = useMutation(api.dayEntries.create);
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
	const canContinueFromBasics = isHomework
		? trimmedSubject.length > 0
		: trimmedSubject.length > 0 && trimmedExamType.length > 0;
	const scheduledDurationMinutes = getDurationBetweenTimes(
		plannedTime,
		plannedEndTime,
	);
	const canCreateHomework = trimmedSubject.length > 0;
	const canCreateExam = trimmedSubject.length > 0 && trimmedExamType.length > 0;
	const canWriteEntries = Boolean(user && isConvexAuthenticated);

	const title = isHomework ? "Hausaufgabe eintragen" : "Prüfung eintragen";
	const subtitle = isHomework
		? step === "basics"
			? "Trage zuerst Fälligkeit, Fach und Notiz ein."
			: "Plane jetzt, wann du die Hausaufgabe erledigst."
		: "Trage Datum, Uhrzeit, Fach und Prüfungsart ein.";

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
				}),
			);
		}
		if (pickerTarget === "plannedEndTime") {
			const next = new Date(plannedEndTime);
			next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
			setPlannedEndTime(next);
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
			capture(isHomework ? "homework_created" : "exam_created", {
				entry_id: createdEntryId,
				subject: trimmedSubject,
				planned_day_key: nextDayKey,
				duration_minutes: resolvedDurationMinutes,
				...(isHomework
					? { due_day_key: getDayKey(dueDate) }
					: { exam_type_label: trimmedExamType }),
			});
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

		if (step === "planning") {
			setStep("basics");
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

		const isSubjectSelect = selectTarget === "subject";
		const title = isSubjectSelect
			? "Schulfach auswählen"
			: "Prüfungsart auswählen";
		const options = isSubjectSelect ? SUBJECT_OPTIONS : EXAM_TYPE_OPTIONS;
		const selectedValue = isSubjectSelect ? subject : examTypeLabel;

		return (
			<SelectSheet
				visible
				title={title}
				options={options}
				selectedValue={selectedValue}
				onClose={closeSelect}
				onSelect={(option) => {
					if (isSubjectSelect) {
						setSubject(option);
					} else {
						setExamTypeLabel(option);
					}
				}}
				renderOptionIcon={(option, isSelected) => {
					if (isSubjectSelect) {
						const SubjectIcon =
							subjectIconByOption[option as keyof typeof subjectIconByOption] ??
							BookOpen;

						return (
							<SubjectIcon
								size={19}
								color={
									isSelected ? SELECTED_OPTION_ICON_COLOR : FIELD_ICON_COLOR
								}
								strokeWidth={2}
							/>
						);
					}

					return (
						<ClipboardList
							size={19}
							color={isSelected ? SELECTED_OPTION_ICON_COLOR : FIELD_ICON_COLOR}
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
			<StatusBar style="dark" />
			<KeyboardSafeScrollView
				ref={scrollViewRef}
				className="flex-1"
				bottomOffset={128}
				contentContainerStyle={{
					paddingHorizontal: 32,
					paddingTop: isHomework ? Math.max(insets.top + 28, 58) : 80,
					paddingBottom: isHomework ? 168 : 80,
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
										color={FIELD_ICON_COLOR}
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
											color={FIELD_TEXT_COLOR}
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
										color={FIELD_ICON_COLOR}
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
												color={FIELD_ICON_COLOR}
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
												color={FIELD_ICON_COLOR}
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
						<HomeworkScreenHeader title="Prüfungstermin" onBack={handleBack} />
						<View className="mb-7">
							<Text className="font-poppins font-semibold text-body-2 text-text">
								{title}
							</Text>
							<Text className="mt-2 font-poppins text-body-3 text-secondary-text">
								{subtitle}
							</Text>
						</View>
					</>
				)}

				{!isHomework && step === "basics" ? (
					<>
						<HomeworkPillField
							label="Prüfungsdatum"
							value={formatCompactDate(plannedDate)}
							icon={
								<CalendarDays
									size={20}
									color={FIELD_ICON_COLOR}
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
											color={FIELD_ICON_COLOR}
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
											color={FIELD_ICON_COLOR}
											strokeWidth={2.1}
										/>
									}
									onPress={() => openPicker("plannedEndTime")}
									className="min-h-16 px-5"
								/>
							</View>
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
										color={FIELD_TEXT_COLOR}
										strokeWidth={2.1}
									/>
								</FieldAccessory>
							</FieldTrigger>
						</Field>

						<Field className="mb-8">
							<FieldLabel>Prüfungsart</FieldLabel>
							<FieldTrigger
								activeOpacity={0.86}
								onPress={() => openSelect("examType")}
								className="min-h-16 rounded-input px-5"
							>
								<Text
									className={cn(
										"flex-1 font-poppins text-body-2",
										examTypeLabel ? "text-text" : "text-secondary-text",
									)}
									numberOfLines={1}
								>
									{examTypeLabel || "Wähle die Prüfungsart aus"}
								</Text>
								<FieldAccessory>
									<ChevronDown
										size={20}
										color={FIELD_TEXT_COLOR}
										strokeWidth={2.1}
									/>
								</FieldAccessory>
							</FieldTrigger>
						</Field>
					</>
				) : null}
			</KeyboardSafeScrollView>
			<KeyboardStickyView enabled={shouldUseKeyboardStickyActions(Platform.OS)}>
				{isHomework ? (
					<View
						className="px-6"
						style={{
							paddingBottom: Math.max(insets.bottom + 10, 24),
						}}
					>
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
					</View>
				) : (
					<View
						className="px-6"
						style={{
							paddingBottom: Math.max(insets.bottom + 10, 24),
						}}
					>
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
					</View>
				)}
			</KeyboardStickyView>
			{renderPicker()}
			{renderSelectSheet()}
		</View>
	);
}
