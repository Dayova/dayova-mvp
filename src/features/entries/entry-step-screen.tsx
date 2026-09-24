import { useConvexAuth, useMutation } from "convex/react";
import { Redirect, Stack, useRouter } from "expo-router";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	ActivityIndicator,
	Keyboard,
	type LayoutChangeEvent,
	Platform,
	View,
} from "react-native";
import {
	type KeyboardAwareScrollViewRef,
	KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import {
	ExamDateSelector,
	ExamSubjectPicker,
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
import { CalendarDays, ChevronDown, Clock3 } from "~/components/ui/icon";
import { shouldUseKeyboardStickyActions } from "~/components/ui/keyboard-safe-scroll";
import { KeyboardSafeScrollView } from "~/components/ui/keyboard-safe-scroll-view";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { useAuthSession } from "~/context/AuthContext";
import { getExamEntryCreationProgress } from "~/features/learning-plans/creation-progress";
import { useLearningPlanCreationProgress } from "~/features/learning-plans/creation-progress-shell";
import { getErrorMessage } from "~/features/learning-plans/utils";
import { SubjectPickerSheet } from "~/features/subjects/subject-picker";
import type { SubjectSelection } from "~/features/subjects/use-subject-options";
import { getDayKey, startOfLocalDay } from "~/lib/day-key";
import { EXAM_TYPE_OPTIONS } from "~/lib/entry-options";
import {
	constrainEndTimeForStart,
	getDurationBetweenTimes,
	MAX_EXAM_DURATION_MINUTES,
	MIN_EXAM_DURATION_MINUTES,
	shiftEndTimeForStartChange,
} from "~/lib/entry-time";
import { getExamDatePickerRange } from "~/lib/exam-date";
import { goBackOrReplace, useBackIntent } from "~/lib/navigation";
import { ROUTES } from "~/lib/routes";
import { useDayovaTheme } from "~/lib/theme";
import { useFeatureAnalytics } from "~/lib/use-feature-analytics";
import { useValidationAnalytics } from "~/lib/use-validation-analytics";
import { cn } from "~/lib/utils";

import { useEntryDraft } from "./entry-draft";
import { type EntryStep, entryStepPath } from "./entry-routes";

type PickerTarget =
	| "dueDate"
	| "plannedDate"
	| "plannedTime"
	| "plannedEndTime";
type SelectTarget = "subject";

const KEYBOARD_DISMISS_FALLBACK_MS = 280;
const EXAM_DURATION_OPTIONS = {
	minimumMinutes: MIN_EXAM_DURATION_MINUTES,
	maximumMinutes: MAX_EXAM_DURATION_MINUTES,
} as const;

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

export function EntryStepScreen({ step }: { step: EntryStep }) {
	const { initialized, draft } = useEntryDraft();
	if (
		!initialized ||
		(draft.type === "homework"
			? !["basics", "planning"].includes(step)
			: step === "planning")
	)
		return <Redirect href="/home" />;
	return <EntryStepContent step={step} />;
}

function EntryStepContent({ step }: { step: EntryStep }) {
	const trackFeature = useFeatureAnalytics();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { colors } = useDayovaTheme();
	const fieldIconColor = colors.secondaryText;
	const fieldTextColor = colors.text;
	const { user } = useAuthSession();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const createDayEntry = useMutation(api.dayEntries.create);
	const updatePendingExam = useMutation(api.dayEntries.updatePendingExam);
	const { capture } = useValidationAnalytics();
	const {
		draft,
		updateDraft,
		initialParams: params,
		savedExamIdRef,
		entryCreationGateRef,
	} = useEntryDraft();
	const isHomework = draft.type === "homework";
	const {
		subject,
		personalSubjectId,
		examTypeLabel,
		note,
		dueDate,
		plannedDate,
		plannedTime,
		plannedEndTime,
	} = draft;
	const setPersonalSubjectId = (
		personalSubjectId: Id<"personalSubjects"> | undefined,
	) => updateDraft({ personalSubjectId });
	const setSubject = (subject: string) => updateDraft({ subject });
	const setExamTypeLabel = (examTypeLabel: string) =>
		updateDraft({ examTypeLabel });
	const setNote = (note: string) => updateDraft({ note });
	const setDueDate = (dueDate: Date) => updateDraft({ dueDate });
	const setPlannedDate = (plannedDate: Date) => updateDraft({ plannedDate });
	const setPlannedTime = (plannedTime: Date) => updateDraft({ plannedTime });
	const setPlannedEndTime = (plannedEndTime: Date) =>
		updateDraft({ plannedEndTime });
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
	const subjectSelection: SubjectSelection = {
		name: subject,
		...(personalSubjectId ? { personalSubjectId } : {}),
	};
	const selectSubject = (selection: SubjectSelection) => {
		setSubject(selection.name);
		setPersonalSubjectId(selection.personalSubjectId);
	};
	const trimmedExamType = examTypeLabel.trim();
	const selectedExamType = EXAM_TYPE_OPTIONS.find(
		(examType) => examType === trimmedExamType,
	);
	const canContinueFromBasics = trimmedSubject.length > 0;
	const scheduledDurationMinutes = getDurationBetweenTimes(
		plannedTime,
		plannedEndTime,
		isHomework ? undefined : EXAM_DURATION_OPTIONS,
	);
	const canCreateHomework = trimmedSubject.length > 0;
	const canCreateExam = trimmedSubject.length > 0 && trimmedExamType.length > 0;
	const canWriteEntries = Boolean(user && isConvexAuthenticated);
	const examStepTitle =
		step === "examType"
			? "Welche Art von Prüfung ist es?"
			: step === "examDetails"
				? "Welches Fach ist es?"
				: step === "basics"
					? "Wann findet die Prüfung statt?"
					: "Wann findet die Prüfung statt?";
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

	const createEntryWithinGate = async ({
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

		const interaction = isHomework
			? "homework.create"
			: savedExamIdRef.current
				? "exam.update"
				: "exam.create";

		try {
			trackFeature(interaction, "attempted");
			setIsCreating(true);
			setErrorMessage(null);
			const entryFields = {
				dayKey: nextDayKey,
				title: entryTitle,
				subject: trimmedSubject,
				...(personalSubjectId ? { personalSubjectId } : {}),
				kind: isHomework ? "Hausaufgabe" : "Leistungskontrolle",
				...(trimmedNote ? { notes: trimmedNote } : {}),
				...(isHomework
					? {
							time: formatTime(plannedTime),
							dueDateKey: getDayKey(dueDate),
							dueDateLabel: formatDate(dueDate),
						}
					: {}),
				plannedDateLabel: formatDate(plannedDate),
				durationMinutes: resolvedDurationMinutes,
				...(!isHomework ? { examTypeLabel: trimmedExamType } : {}),
			};
			const savedExamId = savedExamIdRef.current;
			if (!isHomework && savedExamId) {
				await updatePendingExam({
					id: savedExamId,
					dayKey: nextDayKey,
					subject: trimmedSubject,
					examTypeLabel: trimmedExamType,
					plannedDateLabel: formatDate(plannedDate),
					durationMinutes: resolvedDurationMinutes,
				});
				createdEntryId = savedExamId;
			} else {
				createdEntryId = await createDayEntry(entryFields);
				if (!isHomework) savedExamIdRef.current = createdEntryId;
			}
			trackFeature(interaction, "succeeded", createdEntryId);
			if (isHomework) {
				void capture("homework_created", {
					day_entry_id: createdEntryId,
					planned_day_key: nextDayKey,
					due_day_key: getDayKey(dueDate),
					duration_minutes: resolvedDurationMinutes,
				});
			} else if (selectedExamType && !savedExamId) {
				void capture("exam_created", {
					day_entry_id: createdEntryId,
					planned_day_key: nextDayKey,
					duration_minutes: resolvedDurationMinutes,
					exam_type: selectedExamType,
				});
			}
		} catch (error) {
			trackFeature(interaction, "failed");
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

	const createEntry = async (options: { redirectToHome?: boolean } = {}) => {
		const result = await entryCreationGateRef.current.run(() =>
			createEntryWithinGate(options),
		);
		return result.status === "completed" ? result.value : undefined;
	};

	const createLearningPlan = async () => {
		if (!canCreateExam || isCreating || !canWriteEntries) {
			return;
		}

		await entryCreationGateRef.current.run(async () => {
			setErrorMessage(null);
			try {
				const createdExam = await createEntryWithinGate({
					redirectToHome: false,
				});
				if (!createdExam?.createdEntryId) return;

				const query = [
					["fromExamEntry", "true"],
					["examDayEntryId", createdExam.createdEntryId],
					["subject", trimmedSubject],
					...(personalSubjectId
						? [["personalSubjectId", personalSubjectId] as const]
						: []),
					["examTypeLabel", trimmedExamType],
					["examDateKey", getDayKey(plannedDate)],
					["examDateLabel", formatDate(plannedDate)],
					["durationMinutes", `${scheduledDurationMinutes}`],
					["topicDescription", params.topicDescription ?? ""],
				]
					.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
					.join("&");
				router.replace(`${ROUTES.createLearningPlan}?${query}`);
			} catch (error) {
				setErrorMessage(
					getErrorMessage(
						error,
						"Deine Prüfung konnte nicht für den Lernplan gespeichert werden. Bitte versuche es erneut.",
					),
				);
			} finally {
				setIsCreating(false);
			}
		});
	};

	const goToStep = useCallback(
		(nextStep: EntryStep) => {
			if (nextStep === step) return;
			Keyboard.dismiss();
			trackFeature("entry.step_changed", "performed", undefined, nextStep);
			router.navigate(entryStepPath(nextStep, isHomework));
		},
		[isHomework, router, step, trackFeature],
	);
	const handleBack = useCallback(() => {
		if (selectTarget) {
			setSelectTarget(null);
			return true;
		}

		if (pickerTarget) {
			setPickerTarget(null);
			return true;
		}

		if (isCreating || entryCreationGateRef.current.isRunning) return true;
		Keyboard.dismiss();
		goBackOrReplace(router, "/home");
		return true;
	}, [entryCreationGateRef, isCreating, pickerTarget, router, selectTarget]);

	// Ordinary steps belong to the native stack. Overlays and pending writes consume Back.
	const runBackIntent = useBackIntent(
		Boolean(selectTarget || pickerTarget || isCreating),
		handleBack,
	);

	useLearningPlanCreationProgress({
		active: !isHomework,
		currentStep: getExamEntryCreationProgress(step),
		onBack: runBackIntent,
		title: "Prüfung eintragen",
	});

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
		const isExamDatePicker = !isHomework && pickerTarget === "plannedDate";
		const examDateRange = isExamDatePicker
			? getExamDatePickerRange({ selectedDate: plannedDate })
			: null;

		return (
			<DateTimePickerSheet
				display={isExamDatePicker ? "inline" : undefined}
				visible
				value={value}
				mode={mode}
				minimumDate={examDateRange?.minimumDate}
				maximumDate={examDateRange?.maximumDate}
				onChange={handlePickerChange}
				onClose={closePicker}
			/>
		);
	};

	const renderSelectSheet = () => {
		if (!selectTarget) return null;

		return (
			<SubjectPickerSheet
				visible
				selected={subjectSelection}
				onClose={closeSelect}
				onSelect={selectSubject}
			/>
		);
	};

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{
					gestureEnabled: !isCreating && !pickerTarget && !selectTarget,
				}}
			/>
			{!isHomework ? (
				<View className="px-8 pb-8">
					<Text className="font-poppins font-semibold text-heading-2 text-text">
						{examStepTitle}
					</Text>
				</View>
			) : null}
			<KeyboardSafeScrollView
				ref={scrollViewRef}
				className="flex-1"
				bottomOffset={128}
				contentContainerStyle={{
					paddingHorizontal: 32,
					paddingTop: isHomework ? Math.max(insets.top + 28, 58) : 0,
					paddingBottom: 168,
				}}
			>
				{isHomework ? (
					step === "basics" ? (
						<>
							<HomeworkScreenHeader title="Abgabe" onBack={runBackIntent} />
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
							<HomeworkScreenHeader title="Erledigen" onBack={runBackIntent} />
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
					// biome-ignore lint/complexity/noUselessFragments: Keeps the exam flow grouped as the sibling branch of the homework flow.
					<>
						<View>
							{step === "basics" ? (
								<ExamDateSelector
									selectedDate={plannedDate}
									onOpen={() => openPicker("plannedDate")}
								/>
							) : step === "examType" ? (
								<ExamTypePicker
									selectedValue={examTypeLabel}
									onSelect={setExamTypeLabel}
								/>
							) : (
								<ExamSubjectPicker
									selectedValue={subjectSelection}
									onSelect={selectSubject}
								/>
							)}
						</View>
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
									goToStep("planning");
									return;
								}
								void createEntry();
							}}
						>
							<Text>Weiter</Text>
						</Button>
					</StickyActionFooter>
				) : (
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
								(step === "examType" && !trimmedExamType) ||
								(step === "examDetails" && !trimmedSubject) ||
								(step === "basics" && (isCreating || !canWriteEntries))
							}
							onPress={() => {
								if (step === "examType") {
									if (!trimmedExamType) return;
									goToStep("examDetails");
									return;
								}
								if (step === "examDetails") {
									if (!trimmedSubject) return;
									goToStep("basics");
									return;
								}
								if (step === "basics") {
									void createLearningPlan();
								}
							}}
						>
							{step === "basics" && isCreating ? (
								<ActivityIndicator color="#FFFFFF" />
							) : (
								<Text>Weiter</Text>
							)}
						</Button>
					</StickyActionFooter>
				)}
			</KeyboardStickyView>
			{renderPicker()}
			{renderSelectSheet()}
		</View>
	);
}
