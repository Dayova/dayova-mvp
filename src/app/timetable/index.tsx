import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { fetch } from "expo/fetch";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Platform,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
	ScanImage,
} from "~/components/ui/icon";
import {
	PortraitContent,
	useContentSizeLayout,
} from "~/components/ui/portrait-content";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { SelectSheet } from "~/components/ui/select-sheet";
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
import { TimetableWeekEditor } from "~/features/timetable/timetable-week-editor";
import { ROUTES } from "~/lib/routes";
import { triggerSuccessHaptic } from "~/lib/safe-haptics";
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
const TIMETABLE_WEEKDAY_VALUES = TIMETABLE_WEEKDAYS.map((day) => day.value);

// This is a native rendering control with no NativeWind equivalent.
const continuousBorderStyle = {
	borderCurve: "continuous",
} satisfies ViewStyle;

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

function TimetableSourceActions({
	isBusy,
	isProcessing,
	onPickFile,
	onTakePhoto,
}: {
	isBusy: boolean;
	isProcessing: boolean;
	onPickFile: () => void;
	onTakePhoto: () => void;
}) {
	const { colors } = useDayovaTheme();

	return (
		<View className="flex-row gap-3">
			<Button
				accessibilityLabel="Stundenplan als Datei auswählen"
				className="flex-1 px-4"
				size="sm"
				disabled={isBusy || isProcessing}
				onPress={onPickFile}
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
				onPress={onTakePhoto}
			>
				<ScanImage size={19} color={colors.background} strokeWidth={2} />
				<Text>Foto</Text>
			</Button>
		</View>
	);
}

export default function TimetableScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const contentSizeLayout = useContentSizeLayout({
		requestedHorizontalPadding: 24,
	});
	const { user } = useAuthSession();
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
	const [dayPickerLessonKey, setDayPickerLessonKey] = useState<string | null>(
		null,
	);
	const [selectedDay, setSelectedDay] = useState(1);
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
	const updateLesson = (
		lessonKey: string,
		patch: Partial<TimetableLessonDraft>,
	) => {
		if (!selectedTimetable) return;
		updateLessons(selectedTimetable.id, (current) =>
			current.map((lesson) =>
				lesson.key === lessonKey ? { ...lesson, ...patch } : lesson,
			),
		);
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

	const addManualLesson = (dayOfWeek = selectedDay) => {
		void runTask(async () => {
			const timetableId = selectedTimetable?.id ?? (await ensureDraft());
			manualLessonKeyRef.current += 1;
			const currentLessons =
				selectedTimetable?.id === timetableId ? lessons : [];
			setEditor({
				timetableId,
				lessons: [
					...currentLessons,
					createEmptyTimetableLesson(
						`manual-${manualLessonKeyRef.current}`,
						dayOfWeek,
					),
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
			router.replace(ROUTES.home);
			void triggerSuccessHaptic({ platform: Platform.OS });
		});
	};

	const activePickerLesson = timePickerTarget
		? lessons.find((lesson) => lesson.key === timePickerTarget.lessonKey)
		: null;
	const activePickerValue =
		activePickerLesson && timePickerTarget
			? activePickerLesson[timePickerTarget.field]
			: "08:00";
	const activeDayPickerLesson = dayPickerLessonKey
		? lessons.find((lesson) => lesson.key === dayPickerLessonKey)
		: null;
	const isAddDisabled =
		!isAuthenticated ||
		isBusy ||
		isProcessing ||
		lessons.length >= MAX_TIMETABLE_LESSONS;
	const saveAccessibilityLabel =
		selectedTimetable?.status === "active"
			? "Änderungen am Stundenplan speichern"
			: "Stundenplan übernehmen";

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
			<PortraitContent
				className="bg-background"
				style={{
					// Safe-area and responsive horizontal padding are runtime layout data.
					paddingHorizontal: contentSizeLayout.horizontalPadding,
					paddingTop: Math.max(insets.top + 28, 64),
				}}
			>
				<ScreenHeader
					className="mb-5"
					title="Stundenplan"
					onBack={() => router.back()}
					right={
						lessons.length > 0 ? (
							<Button
								accessibilityLabel={saveAccessibilityLabel}
								accessibilityHint="Prüft und aktiviert den gesamten Stundenplan."
								accessibilityState={{ busy: isBusy }}
								disabled={!canSave}
								size="icon"
								onPress={save}
							>
								{isBusy ? (
									<ActivityIndicator color="#FFFFFF" />
								) : (
									<Check size={20} color="#FFFFFF" strokeWidth={2.4} />
								)}
							</Button>
						) : undefined
					}
				/>
			</PortraitContent>
			<ScreenScroll
				includeTopSafeArea={false}
				topPadding={0}
				bottomPadding={120}
				horizontalPadding={24}
			>
				<View className="gap-5">
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

					{lessons.length === 0 ? (
						<>
							<TimetableIntro />
							<TimetableSourceActions
								isBusy={isBusy}
								isProcessing={isProcessing}
								onPickFile={pickFile}
								onTakePhoto={takePhoto}
							/>
							<Button
								accessibilityLabel="Unterrichtsstunde manuell hinzufügen"
								disabled={isAddDisabled}
								size="sm"
								variant="outline"
								onPress={() => addManualLesson(selectedDay)}
							>
								<Text>Stunde manuell hinzufügen</Text>
							</Button>
						</>
					) : (
						<>
							{validationError ? (
								<View
									accessibilityLiveRegion="polite"
									accessibilityRole="alert"
									className="rounded-3xl bg-wrong-subtle px-5 py-4"
								>
									<Text className="font-poppins text-body-4 text-text">
										{validationError}
									</Text>
								</View>
							) : null}

							<TimetableWeekEditor
								lessons={lessons}
								selectedDay={selectedDay}
								isAddDisabled={isAddDisabled}
								onSelectedDayChange={setSelectedDay}
								onAddLesson={addManualLesson}
								onChangeLesson={updateLesson}
								onRemoveLesson={(lessonKey) => {
									if (!selectedTimetable) return;
									updateLessons(selectedTimetable.id, (current) =>
										current.filter((lesson) => lesson.key !== lessonKey),
									);
								}}
								onOpenTime={(lessonKey, field) =>
									setTimePickerTarget({ lessonKey, field })
								}
								onOpenDayPicker={setDayPickerLessonKey}
							/>

							<View className="border-border border-t pt-5">
								<TimetableSourceActions
									isBusy={isBusy}
									isProcessing={isProcessing}
									onPickFile={pickFile}
									onTakePhoto={takePhoto}
								/>
							</View>
						</>
					)}
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

			<SelectSheet
				visible={Boolean(activeDayPickerLesson)}
				title="Wochentag ändern"
				options={TIMETABLE_WEEKDAY_VALUES}
				selectedValue={activeDayPickerLesson?.dayOfWeek ?? ""}
				formatOptionLabel={(value) =>
					TIMETABLE_WEEKDAYS.find((day) => day.value === value)?.label ??
					String(value)
				}
				onSelect={(dayOfWeek) => {
					if (!activeDayPickerLesson) return;
					updateLesson(activeDayPickerLesson.key, { dayOfWeek });
					setSelectedDay(dayOfWeek);
				}}
				onClose={() => setDayPickerLessonKey(null)}
			/>
		</Screen>
	);
}
