import DateTimePicker, {
	type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useConvexAuth, useMutation } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useCallback, useRef, useState } from "react";
import {
	KeyboardAvoidingView,
	type LayoutChangeEvent,
	Platform,
	Pressable,
	ScrollView,
	Switch,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { BackButton, Button } from "~/components/ui/button";
import {
	Field,
	FieldAccessory,
	FieldControl,
	FieldTrigger,
} from "~/components/ui/field";
import {
	CalendarDays,
	CheckCircle2,
	Clock3,
	Bell,
	ChevronDown,
} from "~/components/ui/icon";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/context/AuthContext";
import { getDayKey, parseDayKey, startOfLocalDay } from "~/lib/day-key";
import { goBackOrReplace, useBackIntent } from "~/lib/navigation";
import { ROUTES } from "~/lib/routes";

type EntryType = "homework" | "exam";
type EntryStep = "basics" | "planning" | "success";
type PickerTarget =
	| "dueDate"
	| "plannedDate"
	| "plannedTime"
	| "plannedEndTime";

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

const getMinutesSinceStartOfDay = (date: Date) =>
	date.getHours() * 60 + date.getMinutes();

const getDurationBetweenTimes = (start: Date, end: Date) => {
	const startMinutes = getMinutesSinceStartOfDay(start);
	const endMinutes = getMinutesSinceStartOfDay(end);
	return Math.max(endMinutes - startMinutes, 15);
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
				className="flex-1 font-poppins text-16 text-text/46"
				numberOfLines={1}
				style={{ includeFontPadding: false }}
			>
				{value || placeholder}
			</Text>
			{icon ? <FieldAccessory>{icon}</FieldAccessory> : null}
		</>
	);

	return (
		<Field className="mb-5">
			{label ? (
				<Text
					className="mb-3 font-poppins font-semibold text-text"
					style={{ fontSize: 15, lineHeight: 20, includeFontPadding: false }}
				>
					{label}
				</Text>
			) : null}
			{onPress ? (
				<FieldTrigger
					activeOpacity={0.86}
					onPress={onPress}
					className={`min-h-[76px] rounded-full px-7 ${className ?? ""}`}
					style={{
						borderWidth: 1,
						borderColor: "rgba(17,24,39,0.04)",
						boxShadow: "0 16px 34px rgba(22, 29, 48, 0.10)",
					}}
				>
					{content}
				</FieldTrigger>
			) : (
				<FieldControl
					className={`min-h-[76px] rounded-full px-7 ${className ?? ""}`}
					style={{
						borderWidth: 1,
						borderColor: "rgba(17,24,39,0.04)",
						boxShadow: "0 16px 34px rgba(22, 29, 48, 0.10)",
					}}
				>
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
			<Text className="font-poppins font-semibold text-16 text-text">
				{title}
			</Text>
			<View style={{ width: 48 }} />
		</View>
	);
}

export default function NewEntryScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { user } = useAuth();
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
	const [remindMe, setRemindMe] = useState(false);
	const [createdDayKey, setCreatedDayKey] = useState(getDayKey(initialDate));
	const [isCreating, setIsCreating] = useState(false);
	const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
	const scrollViewRef = useRef<ScrollView | null>(null);
	const subjectInputOffsetY = useRef(0);
	const noteInputOffsetY = useRef(0);

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
			: "Plane jetzt, wann du daran arbeitest."
		: "Trage zuerst Fälligkeit, Fach und Notiz ein.";

	const closePicker = () => setPickerTarget(null);

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
			if (isHomework) {
				const nextEnd = new Date(plannedEndTime);
				const nextEndMinutes = getMinutesSinceStartOfDay(nextEnd);
				const nextStartMinutes = getMinutesSinceStartOfDay(next);
				if (nextEndMinutes <= nextStartMinutes) {
					nextEnd.setHours(
						selectedDate.getHours(),
						selectedDate.getMinutes() + 30,
						0,
						0,
					);
					setPlannedEndTime(nextEnd);
				}
			}
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
		} finally {
			setIsCreating(false);
		}

		setCreatedDayKey(nextDayKey);
		if (isHomework) {
			setStep("success");
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

	const finish = () => {
		router.replace(`/home?dayKey=${encodeURIComponent(createdDayKey)}`);
	};

	const handleBack = useCallback(() => {
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
	}, [pickerTarget, router, step]);

	useBackIntent(
		Boolean(pickerTarget || (step !== "basics" && step !== "success")),
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

	const handleSubjectInputFocus = useCallback(() => {
		scrollToFocusedField(subjectInputOffsetY.current);
	}, [scrollToFocusedField]);

	const handleNoteInputFocus = useCallback(() => {
		scrollToFocusedField(noteInputOffsetY.current);
	}, [scrollToFocusedField]);

	const handleSubjectInputLayout = useCallback((event: LayoutChangeEvent) => {
		subjectInputOffsetY.current = event.nativeEvent.layout.y;
	}, []);

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

		if (Platform.OS === "ios") {
			return (
				<View className="absolute inset-0 z-50 justify-end">
					<Pressable
						className="absolute inset-0 bg-black/28"
						onPress={closePicker}
					/>
					<View className="rounded-t-[32px] bg-white px-4 pt-3 pb-7">
						<View className="mb-1 flex-row justify-end">
							<TouchableOpacity
								accessibilityLabel="Datumsauswahl schließen"
								accessibilityRole="button"
								hitSlop={8}
								onPress={closePicker}
								className="px-3 py-2"
							>
								<Text className="font-bold font-poppins text-16 text-primary">
									Fertig
								</Text>
							</TouchableOpacity>
						</View>
						<View className="items-center">
							<DateTimePicker
								value={value}
								mode={mode}
								display="spinner"
								onChange={handlePickerChange}
							/>
						</View>
					</View>
				</View>
			);
		}

		return (
			<DateTimePicker
				value={value}
				mode={mode}
				display="default"
				onChange={handlePickerChange}
			/>
		);
	};

	if (step === "success") {
		return (
			<View className="flex-1 bg-background px-8 pt-24 pb-10">
				<StatusBar style="dark" />
				<View className="flex-1 items-center justify-center">
					<View
						className="mb-[36px] h-[72px] w-[72px] items-center justify-center rounded-full bg-primary/12"
						style={{
							borderWidth: 1,
							borderColor: "rgba(58,123,255,0.18)",
						}}
					>
						<CheckCircle2 size={34} color="#3A7BFF" strokeWidth={2.2} />
					</View>
					<Text className="text-center font-bold font-poppins text-20 text-text">
						Hausaufgabe eingetragen
					</Text>
					<Text className="mt-[10px] text-center font-poppins text-14 text-text/66">
						Deine Hausaufgabe wurde erfolgreich geplant.
					</Text>
				</View>
				<Button onPress={finish}>
					<Text>Fertig</Text>
				</Button>
			</View>
		);
	}

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ gestureEnabled: true }} />
			<StatusBar style="dark" />
			<KeyboardAvoidingView
				className="flex-1"
				behavior={Platform.OS === "android" ? "height" : undefined}
				keyboardVerticalOffset={0}
			>
				<ScrollView
					ref={scrollViewRef}
					className="flex-1"
					automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
					contentContainerStyle={{
						paddingHorizontal: 32,
						paddingTop: isHomework ? Math.max(insets.top + 28, 58) : 76,
						paddingBottom: isHomework ? 168 : 80,
					}}
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="interactive"
					showsVerticalScrollIndicator={false}
				>
					{isHomework ? (
						step === "basics" ? (
							<>
								<HomeworkScreenHeader title="Abgabe" onBack={handleBack} />
								<View className="mb-7">
									<Text
										className="font-poppins font-semibold text-text"
										style={{
											fontSize: 15,
											lineHeight: 20,
											includeFontPadding: false,
										}}
									>
										Hausaufgabe eintragen
									</Text>
									<Text className="mt-2 font-poppins text-14 text-text/42">
										Trage zuerst Fälligkeit, Fach und Notiz ein.
									</Text>
								</View>

								<HomeworkPillField
									label="Fälligkeitsdatum"
									value={formatCompactDate(dueDate)}
									icon={
										<CalendarDays size={20} color="#9EA1A8" strokeWidth={2.1} />
									}
									onPress={() => setPickerTarget("dueDate")}
								/>

								<View onLayout={handleSubjectInputLayout}>
									<Field>
										<Text
											className="mb-3 font-poppins font-semibold text-text"
											style={{
												fontSize: 15,
												lineHeight: 20,
												includeFontPadding: false,
											}}
										>
											Schulfach
										</Text>
										<FieldControl
											className="min-h-[76px] rounded-full px-7"
											style={{
												borderWidth: 1,
												borderColor: "rgba(17,24,39,0.04)",
												boxShadow: "0 16px 34px rgba(22, 29, 48, 0.10)",
											}}
										>
											<Input
												accessibilityLabel="Schulfach"
												value={subject}
												onChangeText={setSubject}
												onFocus={handleSubjectInputFocus}
												placeholder="Schreibe das Fach hierhin"
											/>
										</FieldControl>
									</Field>
								</View>

								<Field className="mb-8" onLayout={handleNoteInputLayout}>
									<Text
										className="mb-3 font-poppins font-semibold text-text"
										style={{
											fontSize: 15,
											lineHeight: 20,
											includeFontPadding: false,
										}}
									>
										Notizen
									</Text>
									<FieldControl
										className="min-h-[162px] items-start rounded-[32px] px-7 pt-5 pb-5"
										style={{
											borderWidth: 1,
											borderColor: "rgba(17,24,39,0.04)",
											boxShadow: "0 16px 34px rgba(22, 29, 48, 0.10)",
										}}
									>
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
									<Text
										className="font-poppins font-semibold text-text"
										style={{
											fontSize: 15,
											lineHeight: 20,
											includeFontPadding: false,
										}}
									>
										Hausaufgabe eintragen
									</Text>
									<Text className="mt-2 font-poppins text-14 text-text/42">
										Trage nun ein wann du es machst.
									</Text>
								</View>

								<HomeworkPillField
									label="Erledigungsdatum"
									value={formatCompactDate(plannedDate)}
									icon={
										<CalendarDays size={20} color="#9EA1A8" strokeWidth={2.1} />
									}
									onPress={() => setPickerTarget("plannedDate")}
								/>

								<View className="mb-5 flex-row" style={{ columnGap: 12 }}>
									<View className="flex-1">
										<HomeworkPillField
											value={formatTime(plannedTime)}
											placeholder="Von..."
											icon={
												<Clock3 size={19} color="#9EA1A8" strokeWidth={2.1} />
											}
											onPress={() => setPickerTarget("plannedTime")}
											className="min-h-[64px] px-5"
										/>
									</View>
									<View className="flex-1">
										<HomeworkPillField
											value={formatTime(plannedEndTime)}
											placeholder="Bis..."
											icon={
												<Clock3 size={19} color="#9EA1A8" strokeWidth={2.1} />
											}
											onPress={() => setPickerTarget("plannedEndTime")}
											className="min-h-[64px] px-5"
										/>
									</View>
								</View>

								<View
									className="min-h-[76px] flex-row items-center rounded-full bg-white pr-5 pl-7"
									style={{
										borderWidth: 1,
										borderColor: "rgba(17,24,39,0.04)",
										boxShadow: "0 16px 34px rgba(22, 29, 48, 0.10)",
									}}
								>
									<View
										className="h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white"
										style={{
											borderWidth: 1,
											borderColor: "rgba(17,24,39,0.05)",
											boxShadow: "0 8px 18px rgba(22, 29, 48, 0.08)",
										}}
									>
										<Bell size={23} color="#202127" strokeWidth={2} />
									</View>
									<Text
										className="ml-3 flex-1 font-poppins font-semibold text-[#17171C]"
										style={{
											fontSize: 18,
											lineHeight: 22,
											includeFontPadding: false,
										}}
									>
										Erinnere mich
									</Text>
									<View className="self-center" style={{ marginTop: 2 }}>
										<Switch
											value={remindMe}
											onValueChange={setRemindMe}
											trackColor={{ false: "#D7D8DC", true: "#CFE0FF" }}
											thumbColor="#FFFFFF"
											ios_backgroundColor="#D7D8DC"
										/>
									</View>
								</View>
							</>
						)
					) : (
						<>
							<HomeworkScreenHeader
								title="Prüfungstermin"
								onBack={handleBack}
							/>
							<View className="mb-7">
								<Text
									className="font-poppins font-semibold text-text"
									style={{
										fontSize: 15,
										lineHeight: 20,
										includeFontPadding: false,
									}}
								>
									{title}
								</Text>
								<Text className="mt-2 font-poppins text-14 text-text/42">
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
									<CalendarDays size={20} color="#9EA1A8" strokeWidth={2.1} />
								}
								onPress={() => setPickerTarget("plannedDate")}
							/>
							<View className="mb-5 flex-row" style={{ columnGap: 12 }}>
								<View className="flex-1">
									<HomeworkPillField
										value={formatTime(plannedTime)}
										placeholder="Von..."
										icon={
											<Clock3 size={19} color="#9EA1A8" strokeWidth={2.1} />
										}
										onPress={() => setPickerTarget("plannedTime")}
										className="min-h-[64px] px-5"
									/>
								</View>
								<View className="flex-1">
									<HomeworkPillField
										value={formatTime(plannedEndTime)}
										placeholder="Bis..."
										icon={
											<Clock3 size={19} color="#9EA1A8" strokeWidth={2.1} />
										}
										onPress={() => setPickerTarget("plannedEndTime")}
										className="min-h-[64px] px-5"
									/>
								</View>
							</View>

							<Field>
								<Text
									className="mb-3 font-poppins font-semibold text-text"
									style={{
										fontSize: 15,
										lineHeight: 20,
										includeFontPadding: false,
									}}
								>
									Schulfach
								</Text>
								<FieldControl
									className="min-h-[76px] rounded-full px-7"
									style={{
										borderWidth: 1,
										borderColor: "rgba(17,24,39,0.04)",
										boxShadow: "0 16px 34px rgba(22, 29, 48, 0.10)",
									}}
								>
									<Input
										accessibilityLabel="Schulfach"
										value={subject}
										onChangeText={setSubject}
										placeholder="Wähle das Fach aus"
									/>
									<FieldAccessory>
										<ChevronDown size={20} color="#202127" strokeWidth={2.1} />
									</FieldAccessory>
								</FieldControl>
							</Field>

							<Field className="mb-8">
								<Text
									className="mb-3 font-poppins font-semibold text-text"
									style={{
										fontSize: 15,
										lineHeight: 20,
										includeFontPadding: false,
									}}
								>
									Prüfungsart
								</Text>
								<FieldControl
									className="min-h-[76px] rounded-full px-7"
									style={{
										borderWidth: 1,
										borderColor: "rgba(17,24,39,0.04)",
										boxShadow: "0 16px 34px rgba(22, 29, 48, 0.10)",
									}}
								>
									<Input
										accessibilityLabel="Prüfungsart"
										value={examTypeLabel}
										onChangeText={setExamTypeLabel}
										placeholder="Wähle die Prüfungsart aus"
									/>
									<FieldAccessory>
										<ChevronDown size={20} color="#202127" strokeWidth={2.1} />
									</FieldAccessory>
								</FieldControl>
							</Field>
						</>
					) : null}
				</ScrollView>
			</KeyboardAvoidingView>
			{isHomework ? (
				<View
					style={{
						paddingHorizontal: 24,
						paddingBottom: Math.max(insets.bottom + 10, 24),
					}}
				>
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
					className="flex-row"
					style={{
						columnGap: 12,
						paddingHorizontal: 24,
						paddingBottom: Math.max(insets.bottom + 10, 24),
					}}
				>
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
			)}
			{renderPicker()}
		</View>
	);
}
