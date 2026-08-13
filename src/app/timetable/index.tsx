import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { fetch } from "expo/fetch";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Platform,
	Pressable,
	type TextStyle,
	type ViewStyle,
	View,
} from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import {
	type DateTimePickerEvent,
	DateTimePickerSheet,
} from "~/components/ui/date-time-picker-sheet";
import {
	Attachment,
	CalendarDays,
	Check,
	Clock3,
	ScanImage,
	Trash2,
} from "~/components/ui/icon";
import { Input } from "~/components/ui/input";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuthSession } from "~/context/AuthContext";
import { getUploadFailureMessage } from "~/features/learning-plans/utils";
import {
	createEmptyTimetableLesson,
	getTimetableLessonError,
	MAX_TIMETABLE_LESSONS,
	sortTimetableLessons,
	TIMETABLE_WEEKDAYS,
	type TimetableLessonDraft,
} from "~/features/timetable/timetable-editor";
import { useDayovaTheme } from "~/lib/theme";
import { validateUploadFile } from "~/lib/upload-policy";
import { getUserFacingErrorMessage } from "~/lib/user-facing-errors";

const TIMETABLE_FILE_TYPES = [
	"application/pdf",
	"image/jpeg",
	"image/png",
	"image/webp",
];
const UPLOAD_TIMEOUT_MS = 45_000;
const UPLOAD_COMPLETION_FAILURE_MESSAGE =
	"Die Datei wurde übertragen, aber Dayova konnte den Upload nicht abschließen. Bitte versuche es erneut.";

// These are native rendering controls with no NativeWind equivalent.
const continuousBorderStyle = {
	borderCurve: "continuous",
} satisfies ViewStyle;
const tabularNumberStyle = {
	fontVariant: ["tabular-nums"],
} satisfies TextStyle;

type TimePickerTarget = {
	lessonKey: string;
	field: "startTime" | "endTime";
};

type EditorSession = {
	timetableId: Id<"timetables">;
	lessons: TimetableLessonDraft[];
};

type UploadAsset = {
	uri: string;
	name: string;
	mimeType?: string | null;
	size?: number | null;
};

const dateForTime = (time: string) => {
	const [hours, minutes] = time.split(":").map(Number);
	const date = new Date();
	date.setHours(hours || 0, minutes || 0, 0, 0);
	return date;
};

const formatTime = (date: Date) =>
	`${date.getHours().toString().padStart(2, "0")}:${date
		.getMinutes()
		.toString()
		.padStart(2, "0")}`;

function TimetableIntro() {
	const { colors } = useDayovaTheme();

	return (
		<View
			className="overflow-hidden rounded-card border border-border bg-card p-6"
			style={continuousBorderStyle}
		>
			<View className="h-14 w-14 items-center justify-center rounded-full bg-system-subtle">
				<CalendarDays size={26} color={colors.primaryStrong} strokeWidth={2} />
			</View>
			<Text className="mt-5 font-poppins font-semibold text-heading-2 text-text">
				Deine Schulzeiten im Tagesplan
			</Text>
			<Text className="mt-3 font-poppins text-body-3 text-secondary-text">
				Lade ein Bild oder PDF hoch. Prüfe die erkannten Stunden, bevor sie bei
				„Heute“ erscheinen und Lernzeiten blockieren.
			</Text>
		</View>
	);
}

function TimetableStatus({
	status,
	errorMessage,
}: {
	status: string;
	errorMessage?: string | null;
}) {
	if (status === "processing") {
		return (
			<View
				accessibilityLiveRegion="polite"
				accessibilityRole="progressbar"
				className="flex-row items-center rounded-3xl bg-system-subtle px-5 py-4"
			>
				<ActivityIndicator />
				<View className="ml-3 flex-1">
					<Text className="font-poppins font-semibold text-body-3 text-text">
						Stundenplan wird gelesen …
					</Text>
					<Text className="mt-1 font-poppins text-body-4 text-secondary-text">
						Du kannst die erkannten Stunden gleich prüfen.
					</Text>
				</View>
			</View>
		);
	}

	if (status === "failed" && errorMessage) {
		return (
			<View
				accessibilityLiveRegion="polite"
				className="rounded-3xl bg-wrong-subtle px-5 py-4"
			>
				<Text className="font-poppins font-semibold text-body-3 text-text">
					Automatische Erkennung fehlgeschlagen
				</Text>
				<Text className="mt-1 font-poppins text-body-4 text-secondary-text">
					{errorMessage}
				</Text>
			</View>
		);
	}

	if (status === "active") {
		return (
			<View className="flex-row items-center rounded-3xl bg-success-subtle px-5 py-4">
				<Check size={20} color="#34C759" strokeWidth={2.2} />
				<Text className="ml-3 flex-1 font-poppins font-semibold text-body-3 text-text">
					Dieser Stundenplan ist aktiv.
				</Text>
			</View>
		);
	}

	return null;
}

function TimeButton({
	label,
	value,
	onPress,
}: {
	label: string;
	value: string;
	onPress: () => void;
}) {
	const { colors } = useDayovaTheme();
	return (
		<View className="flex-1">
			<Text className="mb-1 font-poppins text-body-5 text-secondary-text">
				{label}
			</Text>
			<Pressable
				accessibilityLabel={`${label}: ${value}`}
				accessibilityRole="button"
				className="h-12 flex-row items-center justify-between rounded-2xl bg-muted px-4 active:opacity-75"
				onPress={onPress}
			>
				<Text
					className="font-poppins font-semibold text-body-3 text-text"
					style={tabularNumberStyle}
				>
					{value}
				</Text>
				<Clock3 size={17} color={colors.secondaryText} strokeWidth={2} />
			</Pressable>
		</View>
	);
}

function LessonEditorCard({
	lesson,
	onChange,
	onRemove,
	onOpenTime,
}: {
	lesson: TimetableLessonDraft;
	onChange: (patch: Partial<TimetableLessonDraft>) => void;
	onRemove: () => void;
	onOpenTime: (field: "startTime" | "endTime") => void;
}) {
	const { colors } = useDayovaTheme();

	return (
		<View
			className="rounded-card border border-border bg-card p-5"
			style={continuousBorderStyle}
		>
			<View className="flex-row items-center justify-between">
				<Text className="font-poppins font-semibold text-body-3 text-text">
					Unterrichtsstunde
				</Text>
				<Pressable
					accessibilityLabel={`${lesson.subject || "Leere Stunde"} entfernen`}
					accessibilityRole="button"
					hitSlop={8}
					className="h-11 w-11 items-center justify-center rounded-full bg-muted active:opacity-75"
					onPress={onRemove}
				>
					<Trash2 size={18} color={colors.wrong} strokeWidth={2} />
				</Pressable>
			</View>

			<View className="mt-4 flex-row flex-wrap gap-2">
				{TIMETABLE_WEEKDAYS.map((day) => {
					const selected = lesson.dayOfWeek === day.value;
					return (
						<Pressable
							key={day.value}
							accessibilityLabel={day.label}
							accessibilityRole="radio"
							accessibilityState={{ checked: selected }}
							className={
								selected
									? "h-11 min-w-11 items-center justify-center rounded-full bg-primary px-3"
									: "h-11 min-w-11 items-center justify-center rounded-full bg-muted px-3"
							}
							onPress={() => onChange({ dayOfWeek: day.value })}
						>
							<Text
								className={
									selected
										? "font-poppins font-semibold text-body-4 text-white"
										: "font-poppins font-semibold text-body-4 text-secondary-text"
								}
							>
								{day.shortLabel}
							</Text>
						</Pressable>
					);
				})}
			</View>

			<View className="mt-4 h-14 justify-center rounded-2xl bg-muted px-4">
				<Input
					accessibilityLabel="Unterrichtsfach"
					autoCapitalize="words"
					maxLength={80}
					placeholder="Fach, z. B. Mathematik"
					value={lesson.subject}
					onChangeText={(subject) => onChange({ subject })}
				/>
			</View>
			<View className="mt-3 h-14 justify-center rounded-2xl bg-muted px-4">
				<Input
					accessibilityLabel="Raum, optional"
					autoCapitalize="characters"
					maxLength={40}
					placeholder="Raum (optional)"
					value={lesson.room}
					onChangeText={(room) => onChange({ room })}
				/>
			</View>
			<View className="mt-4 flex-row gap-3">
				<TimeButton
					label="Beginn"
					value={lesson.startTime}
					onPress={() => onOpenTime("startTime")}
				/>
				<TimeButton
					label="Ende"
					value={lesson.endTime}
					onPress={() => onOpenTime("endTime")}
				/>
			</View>
		</View>
	);
}

export default function TimetableScreen() {
	const router = useRouter();
	const { user } = useAuthSession();
	const { colors } = useDayovaTheme();
	const { isAuthenticated } = useConvexAuth();
	const timetableState = useQuery(
		api.timetables.getMine,
		user && isAuthenticated ? {} : "skip",
	);
	const createDraft = useMutation(api.timetables.createDraft);
	const generateUploadUrl = useMutation(api.timetables.generateUploadUrl);
	const registerUploadedDocument = useAction(
		api.timetables.registerUploadedDocument,
	);
	const extractTimetable = useAction(api.timetableAi.extract);
	const saveAndActivate = useMutation(api.timetables.saveAndActivate);
	const selectedTimetable =
		timetableState?.draft ?? timetableState?.active ?? null;
	const [editor, setEditor] = useState<EditorSession | null>(null);
	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [timePickerTarget, setTimePickerTarget] =
		useState<TimePickerTarget | null>(null);
	const taskInFlightRef = useRef(false);
	const manualLessonKeyRef = useRef(0);

	const serverLessons = useMemo(
		() =>
			(selectedTimetable?.lessons ?? []).map((lesson) => ({
				key: lesson.id,
				dayOfWeek: lesson.dayOfWeek,
				subject: lesson.subject,
				startTime: lesson.startTime,
				endTime: lesson.endTime,
				room: lesson.room ?? "",
			})),
		[selectedTimetable?.lessons],
	);
	const lessons =
		editor && editor.timetableId === selectedTimetable?.id
			? editor.lessons
			: serverLessons;
	const validationError = getTimetableLessonError(lessons);
	const isProcessing = selectedTimetable?.status === "processing";
	const canSave =
		Boolean(selectedTimetable) &&
		!validationError &&
		!isBusy &&
		!isProcessing &&
		isAuthenticated;

	const updateLessons = (
		timetableId: Id<"timetables">,
		update: (current: TimetableLessonDraft[]) => TimetableLessonDraft[],
	) => {
		const current =
			editor?.timetableId === timetableId ? editor.lessons : serverLessons;
		setEditor({
			timetableId,
			lessons: update(current),
		});
	};

	const ensureDraft = async () => {
		if (
			selectedTimetable &&
			selectedTimetable.status !== "active" &&
			selectedTimetable.status !== "archived"
		) {
			return selectedTimetable.id;
		}
		return await createDraft({});
	};

	const runTask = async (task: () => Promise<void>) => {
		if (taskInFlightRef.current) return;
		taskInFlightRef.current = true;
		setIsBusy(true);
		setErrorMessage(null);
		try {
			await task();
		} catch (error) {
			setErrorMessage(
				getUserFacingErrorMessage(error, "Bitte versuche es erneut.", {
					source: "timetable",
				}),
			);
		} finally {
			taskInFlightRef.current = false;
			setIsBusy(false);
		}
	};

	const addManualLesson = () => {
		void runTask(async () => {
			const timetableId = selectedTimetable?.id ?? (await ensureDraft());
			manualLessonKeyRef.current += 1;
			const currentLessons =
				selectedTimetable?.id === timetableId ? lessons : [];
			setEditor({
				timetableId,
				lessons: [
					...currentLessons,
					createEmptyTimetableLesson(`manual-${manualLessonKeyRef.current}`),
				],
			});
		});
	};

	const uploadAndExtract = async (asset: UploadAsset) => {
		const file = new File(asset.uri);
		const fileSizeBytes = asset.size ?? file.info().size ?? 0;
		const fileType = asset.mimeType || "application/octet-stream";
		const validation = validateUploadFile({
			name: asset.name,
			size: fileSizeBytes,
		});
		if (!validation.valid) throw new Error(validation.message);

		const timetableId = await ensureDraft();
		const uploadData = await generateUploadUrl({ timetableId });
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
		let response: Response;
		try {
			response = await fetch(uploadData.uploadUrl, {
				method: uploadData.storageProvider === "r2" ? "PUT" : "POST",
				headers: { "Content-Type": fileType },
				body: file,
				signal: controller.signal,
			});
		} finally {
			clearTimeout(timeout);
		}
		const responseBody = await response.text();
		if (!response.ok) {
			throw new Error(
				getUploadFailureMessage(
					uploadData.storageProvider,
					response,
					responseBody,
				),
			);
		}
		let storageId = uploadData.storageId;
		if (!storageId) {
			try {
				storageId =
					(JSON.parse(responseBody) as { storageId?: string }).storageId ??
					null;
			} catch {
				storageId = null;
			}
		}
		if (!storageId) throw new Error(UPLOAD_COMPLETION_FAILURE_MESSAGE);

		await registerUploadedDocument({
			timetableId,
			uploadToken: uploadData.uploadToken,
			storageId,
			fileName: asset.name,
			fileType,
			fileSizeBytes,
		});
		await extractTimetable({ timetableId });
		setEditor(null);
	};

	const pickFile = () => {
		void runTask(async () => {
			const result = await DocumentPicker.getDocumentAsync({
				type: TIMETABLE_FILE_TYPES,
				multiple: false,
				copyToCacheDirectory: true,
			});
			if (result.canceled) return;
			const asset = result.assets[0];
			if (!asset) return;
			await uploadAndExtract({
				uri: asset.uri,
				name: asset.name,
				mimeType: asset.mimeType,
				size: asset.size,
			});
		});
	};

	const takePhoto = () => {
		void runTask(async () => {
			const permission = await ImagePicker.requestCameraPermissionsAsync();
			if (!permission.granted) {
				throw new Error(
					"Erlaube den Kamerazugriff, um deinen Stundenplan zu fotografieren.",
				);
			}
			const result = await ImagePicker.launchCameraAsync({
				mediaTypes: ["images"],
				quality: 0.9,
			});
			if (result.canceled) return;
			const asset = result.assets[0];
			if (!asset) return;
			await uploadAndExtract({
				uri: asset.uri,
				name: asset.fileName ?? "stundenplan.jpg",
				mimeType: asset.mimeType ?? "image/jpeg",
				size: asset.fileSize,
			});
		});
	};

	const save = () => {
		if (!selectedTimetable || validationError) return;
		void runTask(async () => {
			await saveAndActivate({
				timetableId: selectedTimetable.id,
				lessons: sortTimetableLessons(lessons).map((lesson) => ({
					dayOfWeek: lesson.dayOfWeek,
					subject: lesson.subject,
					startTime: lesson.startTime,
					endTime: lesson.endTime,
					...(lesson.room.trim() ? { room: lesson.room.trim() } : {}),
				})),
			});
			setEditor(null);
			await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		});
	};

	const activePickerLesson = timePickerTarget
		? lessons.find((lesson) => lesson.key === timePickerTarget.lessonKey)
		: null;
	const activePickerValue =
		activePickerLesson && timePickerTarget
			? activePickerLesson[timePickerTarget.field]
			: "08:00";

	const updateTime = (event: DateTimePickerEvent, selectedDate?: Date) => {
		if (
			event.type !== "set" ||
			!selectedDate ||
			!timePickerTarget ||
			!selectedTimetable
		) {
			return;
		}
		const { lessonKey, field } = timePickerTarget;
		updateLessons(selectedTimetable.id, (current) =>
			current.map((lesson) =>
				lesson.key === lessonKey
					? { ...lesson, [field]: formatTime(selectedDate) }
					: lesson,
			),
		);
		if (Platform.OS === "android") setTimePickerTarget(null);
	};

	return (
		<Screen>
			<ThemedStatusBar />
			<ScreenScroll topPadding={64} bottomPadding={120} horizontalPadding={24}>
				<ScreenHeader title="Stundenplan" onBack={() => router.back()} />
				<View className="gap-5">
					<TimetableIntro />
					{selectedTimetable ? (
						<TimetableStatus
							status={selectedTimetable.status}
							errorMessage={selectedTimetable.errorMessage}
						/>
					) : null}
					{errorMessage ? (
						<View
							accessibilityLiveRegion="polite"
							className="rounded-3xl bg-wrong-subtle px-5 py-4"
						>
							<Text className="font-poppins text-body-4 text-text">
								{errorMessage}
							</Text>
						</View>
					) : null}

					<View className="flex-row gap-3">
						<Button
							accessibilityLabel="Stundenplan als Datei auswählen"
							className="flex-1 px-4"
							size="sm"
							disabled={isBusy || isProcessing}
							onPress={pickFile}
						>
							<Attachment size={19} color="#FFFFFF" strokeWidth={2} />
							<Text>Datei</Text>
						</Button>
						<Button
							accessibilityLabel="Stundenplan fotografieren"
							className="flex-1 px-4"
							size="sm"
							variant="neutral"
							disabled={isBusy || isProcessing}
							onPress={takePhoto}
						>
							<ScanImage size={19} color={colors.background} strokeWidth={2} />
							<Text>Foto</Text>
						</Button>
					</View>

					{lessons.length > 0 ? (
						<View className="pt-3">
							<Text className="font-poppins font-semibold text-heading-2 text-text">
								Stunden prüfen
							</Text>
							<Text className="mt-1 font-poppins text-body-4 text-secondary-text">
								Kontrolliere Fach, Wochentag und Uhrzeit. Erst danach wird der
								Stundenplan aktiv.
							</Text>
						</View>
					) : null}

					{sortTimetableLessons(lessons).map((lesson) => (
						<LessonEditorCard
							key={lesson.key}
							lesson={lesson}
							onChange={(patch) => {
								if (!selectedTimetable) return;
								updateLessons(selectedTimetable.id, (current) =>
									current.map((item) =>
										item.key === lesson.key ? { ...item, ...patch } : item,
									),
								);
							}}
							onRemove={() => {
								if (!selectedTimetable) return;
								updateLessons(selectedTimetable.id, (current) =>
									current.filter((item) => item.key !== lesson.key),
								);
							}}
							onOpenTime={(field) =>
								setTimePickerTarget({ lessonKey: lesson.key, field })
							}
						/>
					))}

					<Button
						accessibilityLabel={
							lessons.length > 0
								? "Weitere Unterrichtsstunde hinzufügen"
								: "Unterrichtsstunde manuell hinzufügen"
						}
						disabled={
							!isAuthenticated ||
							isBusy ||
							isProcessing ||
							lessons.length >= MAX_TIMETABLE_LESSONS
						}
						size="sm"
						variant="outline"
						onPress={addManualLesson}
					>
						<Text>
							{lessons.length > 0
								? "Weitere Stunde hinzufügen"
								: "Stunde manuell hinzufügen"}
						</Text>
					</Button>

					{lessons.length > 0 ? (
						<View>
							<Button disabled={!canSave} onPress={save}>
								{isBusy ? (
									<ActivityIndicator color="#FFFFFF" />
								) : (
									<Text>
										{selectedTimetable?.status === "active"
											? "Änderungen speichern"
											: "Stundenplan übernehmen"}
									</Text>
								)}
							</Button>
							{validationError ? (
								<Text className="mt-3 text-center font-poppins text-body-4 text-secondary-text">
									{validationError}
								</Text>
							) : null}
						</View>
					) : null}
				</View>
			</ScreenScroll>

			<DateTimePickerSheet
				visible={Boolean(timePickerTarget)}
				value={dateForTime(activePickerValue)}
				mode="time"
				display="spinner"
				onChange={updateTime}
				onClose={() => setTimePickerTarget(null)}
			/>
		</Screen>
	);
}
