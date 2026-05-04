import DateTimePicker, {
	type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
	ArrowLeft,
	BookOpen,
	CalendarDays,
	Camera,
	Check,
	CheckCircle2,
	Clock3,
	FileText,
	MoreHorizontal,
	Plus,
	Sparkles,
	Trash2,
	X,
	Zap,
} from "lucide-react-native";
import { type ReactNode, useMemo, useState } from "react";
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	TouchableOpacity,
	View,
} from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/context/AuthContext";
import {
	ACCEPTED_FILE_TYPES,
	formatFileSize,
	validateUploadFile,
} from "~/lib/upload-policy";

type FlowStep = "topic" | "analysisIntro" | "question" | "generating" | "plan";
type PickerTarget = "editDate" | "editStart" | "editEnd";

type PlanSession = {
	id: Id<"learningPlanSessions">;
	phase: "theory" | "practice" | "rehearsal";
	title: string;
	dateKey: string;
	dateLabel: string;
	startTime: string;
	durationMinutes: number;
	goal: string;
	tasks: string[];
	expectedOutcome: string;
	sortOrder: number;
};

type LearningPlanDocument = {
	id: Id<"learningPlanDocuments">;
	fileName: string;
	fileType: string;
	fileSizeBytes: number;
};

type UploadAsset = {
	uri: string;
	name: string;
	mimeType?: string | null;
	size?: number | null;
};

type LearningPlanQuestion = {
	id: string;
	prompt: string;
	targetInsight: string;
};

type LearningPlanSnapshot = {
	plan: {
		id: Id<"learningPlans">;
		status: "draft" | "questionsReady" | "generated" | "accepted";
		knowledgeQuestions: LearningPlanQuestion[];
		sourceSummary?: string;
		insight?: {
			summary: string;
			strengths: string[];
			gaps: string[];
			strategy: string;
		};
	};
	documents: LearningPlanDocument[];
	sessions: PlanSession[];
};

const EMPTY_QUESTIONS: LearningPlanQuestion[] = [];
const ANALYSIS_ORBITS = Array.from({ length: 9 }, (_, index) => ({
	id: `analysis-orbit-${index}`,
	rotation: index * 40,
}));

const phaseIcon = {
	theory: BookOpen,
	practice: Zap,
	rehearsal: CheckCircle2,
};

const phaseColor = {
	theory: "#1A1A1A",
	practice: "#5FC9B0",
	rehearsal: "#3A7BFF",
};

const startOfDay = (date: Date) => {
	const next = new Date(date);
	next.setHours(0, 0, 0, 0);
	return next;
};

const getDateKey = (date: Date) => startOfDay(date).toISOString();

const parseDateKey = (value?: string) => {
	if (!value) return startOfDay(new Date());
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return startOfDay(new Date());
	return parsed;
};

const formatDate = (date: Date) =>
	new Intl.DateTimeFormat("de-DE", {
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(date);

const formatTime = (date: Date) =>
	new Intl.DateTimeFormat("de-DE", {
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);

const minutesFromTime = (time: string) => {
	const match = /^(\d{1,2}):(\d{2})$/.exec(time);
	if (!match) return 17 * 60;
	return Number(match[1]) * 60 + Number(match[2]);
};

const timeFromMinutes = (minutes: number) => {
	const normalized = ((minutes % 1440) + 1440) % 1440;
	const hour = Math.floor(normalized / 60);
	const minute = normalized % 60;
	return `${hour.toString().padStart(2, "0")}:${minute
		.toString()
		.padStart(2, "0")}`;
};

const dateWithTime = (dateKey: string, time: string) => {
	const next = parseDateKey(dateKey);
	const minutes = minutesFromTime(time);
	next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
	return next;
};

const getErrorMessage = (error: unknown, fallback: string) =>
	error instanceof Error ? error.message : fallback;

const wait = (milliseconds: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const isUnauthenticatedError = (error: unknown) =>
	error instanceof Error && error.message.includes("Nicht authentifiziert");

const retryOnceAfterAuthResume = async <TResult,>(
	task: () => Promise<TResult>,
) => {
	try {
		return await task();
	} catch (error) {
		if (!isUnauthenticatedError(error)) {
			throw error;
		}

		await wait(700);
		return await task();
	}
};

const getUploadFailureMessage = (
	provider: "convex" | "r2",
	response: Response,
	responseText: string,
) => {
	if (provider === "r2" && response.status === 403) {
		return [
			"Cloudflare R2 verweigert den Upload.",
			"Pruefe R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY, Schreibzugriff auf den Bucket aus R2_BUCKET_NAME und bei EU-Buckets R2_JURISDICTION=eu.",
		].join(" ");
	}

	const providerLabel = provider === "r2" ? "Cloudflare R2" : "Convex Storage";
	return `Upload zu ${providerLabel} ist fehlgeschlagen (${response.status} ${response.statusText})${
		responseText ? `: ${responseText.slice(0, 240)}` : "."
	}`;
};

function Header({
	title,
	onBack,
	right,
}: {
	title: string;
	onBack: () => void;
	right?: ReactNode;
}) {
	return (
		<View className="mb-8 flex-row items-center justify-between">
			<TouchableOpacity
				activeOpacity={0.75}
				onPress={onBack}
				className="h-11 w-11 items-center justify-center rounded-full bg-black/5"
			>
				<ArrowLeft size={20} color="#1A1A1A" strokeWidth={2.3} />
			</TouchableOpacity>
			<Text className="font-bold font-poppins text-16 text-text">{title}</Text>
			<View className="h-11 w-11 items-center justify-center">{right}</View>
		</View>
	);
}

function SectionTitle({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<View className="mb-7">
			<Text className="font-bold font-poppins text-18 text-text">{title}</Text>
			<Text className="mt-2 font-poppins text-14 text-text/55">
				{description}
			</Text>
		</View>
	);
}

function MaterialCard({
	name,
	size,
	onRemove,
}: {
	name: string;
	size: number;
	onRemove: () => void;
}) {
	return (
		<View
			className="mb-3 flex-row items-center rounded-[24px] bg-white px-4 py-4"
			style={{
				borderWidth: 1,
				borderColor: "rgba(0,0,0,0.08)",
				shadowColor: "#000000",
				shadowOpacity: 0.05,
				shadowRadius: 8,
				shadowOffset: { width: 0, height: 3 },
				elevation: 2,
			}}
		>
			<View className="h-11 w-11 items-center justify-center rounded-full bg-primary/12">
				<FileText size={21} color="#3A7BFF" strokeWidth={2.2} />
			</View>
			<View className="ml-3 flex-1">
				<Text
					numberOfLines={1}
					className="font-bold font-poppins text-14 text-text"
				>
					{name}
				</Text>
				<Text className="mt-1 font-poppins text-12 text-text/50">
					{formatFileSize(size)}
				</Text>
			</View>
			<TouchableOpacity
				activeOpacity={0.75}
				onPress={onRemove}
				className="h-9 w-9 items-center justify-center rounded-full bg-black/5"
			>
				<X size={16} color="#1A1A1A" strokeWidth={2.3} />
			</TouchableOpacity>
		</View>
	);
}

function UploadAction({
	icon,
	label,
	onPress,
	disabled,
}: {
	icon: ReactNode;
	label: string;
	onPress: () => void;
	disabled: boolean;
}) {
	return (
		<TouchableOpacity
			activeOpacity={0.86}
			onPress={onPress}
			disabled={disabled}
			className="min-h-[106px] flex-1 items-center justify-center rounded-[26px] bg-white px-3 py-4"
			style={{
				borderWidth: 1.2,
				borderColor: "rgba(0,0,0,0.08)",
				shadowColor: "#000000",
				shadowOpacity: 0.06,
				shadowRadius: 12,
				shadowOffset: { width: 0, height: 5 },
				elevation: 3,
				opacity: disabled ? 0.55 : 1,
			}}
		>
			<View className="h-[52px] w-[52px] items-center justify-center rounded-full border border-primary/15 bg-primary/10">
				{icon}
			</View>
			<Text className="mt-3 text-center font-poppins font-semibold text-12 text-text/62">
				{label}
			</Text>
		</TouchableOpacity>
	);
}

function SessionCard({
	session,
	onEdit,
}: {
	session: PlanSession;
	onEdit: () => void;
}) {
	const Icon = phaseIcon[session.phase];
	const color = phaseColor[session.phase];
	const endTime = timeFromMinutes(
		minutesFromTime(session.startTime) + session.durationMinutes,
	);

	return (
		<TouchableOpacity
			activeOpacity={0.88}
			onPress={onEdit}
			className="mb-4 flex-row items-center rounded-[28px] bg-white px-4 py-4"
			style={{
				borderWidth: 1,
				borderColor: "rgba(0,0,0,0.07)",
				shadowColor: "#000000",
				shadowOpacity: 0.05,
				shadowRadius: 10,
				shadowOffset: { width: 0, height: 4 },
				elevation: 2,
			}}
		>
			<View className="h-14 w-14 items-center justify-center rounded-full bg-[#1A1A1A]">
				<Text className="font-bold font-poppins text-14 text-white">
					{session.dateLabel.split(" ")[0]}
				</Text>
			</View>
			<View className="ml-4 flex-1">
				<View className="flex-row items-center">
					<Text className="font-bold font-poppins text-16 text-text">
						{session.title}
					</Text>
					<Icon
						size={18}
						color={color}
						strokeWidth={2.2}
						style={{ marginLeft: 6 }}
					/>
				</View>
				<Text className="mt-1 font-poppins text-12 text-text/55">
					{session.startTime} - {endTime}
				</Text>
			</View>
			<View className="h-11 w-11 items-center justify-center rounded-full border border-black/10">
				<MoreHorizontal size={19} color="#1A1A1A" strokeWidth={2.2} />
			</View>
		</TouchableOpacity>
	);
}

export default function LearningPlanScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{
		subject?: string;
		examTypeLabel?: string;
		examDateKey?: string;
		examDateLabel?: string;
		examTime?: string;
		durationMinutes?: string;
	}>();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const startPlan = useMutation(api.learningPlans.start);
	const updateBasics = useMutation(api.learningPlans.updateBasics);
	const generateUploadUrl = useMutation(api.learningPlans.generateUploadUrl);
	const registerUploadedDocument = useAction(
		api.learningPlans.registerUploadedDocument,
	);
	const removeDocument = useMutation(api.learningPlans.removeDocument);
	const generateKnowledgeQuestions = useAction(
		api.learningPlanAi.generateKnowledgeQuestions,
	);
	const generatePlan = useAction(api.learningPlanAi.generatePlan);
	const updateSession = useMutation(api.learningPlans.updateSession);
	const removeSession = useMutation(api.learningPlans.removeSession);
	const acceptPlan = useMutation(api.learningPlans.acceptPlan);

	const subject = params.subject?.trim() || "Fach";
	const examTypeLabel = params.examTypeLabel?.trim() || "Leistungskontrolle";
	const examDateKey = params.examDateKey || getDateKey(new Date());
	const examDateLabel =
		params.examDateLabel || formatDate(parseDateKey(examDateKey));
	const examTime = params.examTime || "17:00";
	const durationMinutes = Number(params.durationMinutes ?? 45) || 45;

	const [step, setStep] = useState<FlowStep>("topic");
	const [learningPlanId, setLearningPlanId] =
		useState<Id<"learningPlans"> | null>(null);
	const [topicDescription, setTopicDescription] = useState("");
	const [notes, setNotes] = useState("");
	const [questionIndex, setQuestionIndex] = useState(0);
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successDayKey, setSuccessDayKey] = useState<string | null>(null);
	const [editingSession, setEditingSession] = useState<PlanSession | null>(
		null,
	);
	const [deleteSession, setDeleteSession] = useState<PlanSession | null>(null);
	const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
	const [editDate, setEditDate] = useState(new Date());
	const [editStart, setEditStart] = useState("17:00");
	const [editEnd, setEditEnd] = useState("17:30");

	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && learningPlanId
			? { id: learningPlanId }
			: "skip",
	) ?? null) as LearningPlanSnapshot | null;

	const questions = snapshot?.plan.knowledgeQuestions ?? EMPTY_QUESTIONS;
	const currentQuestion = questions[questionIndex] ?? null;
	const canWrite = Boolean(user && isConvexAuthenticated);
	const canContinueTopic = topicDescription.trim().length >= 8 && canWrite;
	const canUploadMaterial = canWrite && !isBusy;

	const answerList = useMemo(
		() =>
			questions.map((question) => ({
				questionId: question.id,
				answer: answers[question.id]?.trim() ?? "",
			})),
		[answers, questions],
	);

	const ensurePlan = async () => {
		if (learningPlanId) {
			await retryOnceAfterAuthResume(() =>
				updateBasics({
					id: learningPlanId,
					topicDescription,
					notes: notes.trim(),
				}),
			);
			return learningPlanId;
		}

		const id = await retryOnceAfterAuthResume(() =>
			startPlan({
				subject,
				examTypeLabel,
				examDateKey,
				examDateLabel,
				examTime,
				durationMinutes,
				topicDescription,
				notes: notes.trim(),
			}),
		);
		setLearningPlanId(id);
		return id;
	};

	const runWithErrorHandling = async (
		fallback: string,
		task: () => Promise<void>,
	) => {
		setIsBusy(true);
		setErrorMessage(null);
		try {
			await task();
		} catch (error) {
			setErrorMessage(getErrorMessage(error, fallback));
		} finally {
			setIsBusy(false);
		}
	};

	const uploadLearningPlanAsset = async (
		asset: UploadAsset,
		existingLearningPlanId?: Id<"learningPlans">,
	) => {
		const id = existingLearningPlanId ?? (await ensurePlan());
		const fileResponse = await fetch(asset.uri);
		const blob = await fileResponse.blob();
		const fileSizeBytes = asset.size ?? blob.size;
		const fileType = asset.mimeType || blob.type || "application/octet-stream";

		const validation = validateUploadFile({
			name: asset.name,
			size: fileSizeBytes,
		});
		if (!validation.valid) {
			throw new Error(validation.message);
		}

		const uploadData = await retryOnceAfterAuthResume(() =>
			generateUploadUrl({ learningPlanId: id }),
		);
		const uploadResponse = await fetch(uploadData.uploadUrl, {
			method: uploadData.storageProvider === "r2" ? "PUT" : "POST",
			headers: {
				"Content-Type": fileType,
			},
			body: blob,
		});
		if (!uploadResponse.ok) {
			const responseText = await uploadResponse.text();
			throw new Error(
				getUploadFailureMessage(
					uploadData.storageProvider,
					uploadResponse,
					responseText,
				),
			);
		}

		let storageId = uploadData.storageId;
		if (!storageId) {
			const uploadResult = (await uploadResponse.json()) as {
				storageId?: string;
			};
			storageId = uploadResult.storageId ?? null;
		}

		if (!storageId) {
			throw new Error("Upload konnte nicht abgeschlossen werden.");
		}

		await retryOnceAfterAuthResume(() =>
			registerUploadedDocument({
				learningPlanId: id,
				uploadToken: uploadData.uploadToken,
				storageId,
				fileName: asset.name,
				fileType,
				fileSizeBytes,
			}),
		);
	};

	const uploadMaterial = async () => {
		if (!canWrite || isBusy) return;

		await runWithErrorHandling(
			"Die Datei konnte nicht hochgeladen werden.",
			async () => {
				const id = await ensurePlan();
				const result = await DocumentPicker.getDocumentAsync({
					type: ACCEPTED_FILE_TYPES,
					multiple: false,
					copyToCacheDirectory: true,
				});
				if (result.canceled) return;

				const asset = result.assets[0];
				if (!asset) return;

				await uploadLearningPlanAsset(
					{
						uri: asset.uri,
						name: asset.name,
						mimeType: asset.mimeType,
						size: asset.size,
					},
					id,
				);
			},
		);
	};

	const takePhoto = async () => {
		if (!canWrite || isBusy) return;

		await runWithErrorHandling(
			"Das Foto konnte nicht hochgeladen werden.",
			async () => {
				const permission = await ImagePicker.requestCameraPermissionsAsync();
				if (!permission.granted) {
					throw new Error("Kamerazugriff wurde nicht erlaubt.");
				}

				const id = await ensurePlan();
				const result = await ImagePicker.launchCameraAsync({
					mediaTypes: ["images"],
					allowsEditing: false,
					quality: 0.82,
				});
				if (result.canceled) return;

				const asset = result.assets[0];
				if (!asset) return;

				await uploadLearningPlanAsset(
					{
						uri: asset.uri,
						name: asset.fileName ?? `mitschrift-${Date.now()}.jpg`,
						mimeType: asset.mimeType ?? "image/jpeg",
						size: asset.fileSize,
					},
					id,
				);
			},
		);
	};

	const continueToAnalysis = async () => {
		if (!canContinueTopic || isBusy) return;

		await runWithErrorHandling(
			"Die Wissensanalyse konnte nicht vorbereitet werden.",
			async () => {
				const id = await ensurePlan();
				await generateKnowledgeQuestions({ learningPlanId: id });
				setStep("analysisIntro");
			},
		);
	};

	const continueQuestion = async () => {
		if (!currentQuestion) return;
		const answer = answers[currentQuestion.id]?.trim();
		if (!answer) return;

		if (questionIndex < questions.length - 1) {
			setQuestionIndex((value) => value + 1);
			return;
		}

		setStep("generating");
		await runWithErrorHandling(
			"Der Lernplan konnte nicht erstellt werden.",
			async () => {
				if (!learningPlanId) throw new Error("Lernplan fehlt.");
				await generatePlan({
					learningPlanId,
					answers: answerList,
				});
				setStep("plan");
			},
		);
	};

	const openEdit = (session: PlanSession) => {
		setEditingSession(session);
		setEditDate(parseDateKey(session.dateKey));
		setEditStart(session.startTime);
		setEditEnd(
			timeFromMinutes(
				minutesFromTime(session.startTime) + session.durationMinutes,
			),
		);
	};

	const saveEdit = async () => {
		if (!editingSession || isBusy) return;

		await runWithErrorHandling(
			"Der Lerntag konnte nicht gespeichert werden.",
			async () => {
				const startMinutes = minutesFromTime(editStart);
				const endMinutes = minutesFromTime(editEnd);
				const duration =
					endMinutes > startMinutes
						? endMinutes - startMinutes
						: editingSession.durationMinutes;
				await updateSession({
					id: editingSession.id,
					dateKey: getDateKey(editDate),
					dateLabel: formatDate(editDate),
					startTime: editStart,
					durationMinutes: duration,
				});
				setEditingSession(null);
			},
		);
	};

	const confirmDelete = async () => {
		if (!deleteSession || isBusy) return;

		await runWithErrorHandling(
			"Der Lerntag konnte nicht entfernt werden.",
			async () => {
				await removeSession({ id: deleteSession.id });
				setDeleteSession(null);
				setEditingSession(null);
			},
		);
	};

	const acceptGeneratedPlan = async () => {
		if (!learningPlanId || isBusy) return;

		await runWithErrorHandling(
			"Der Lernplan konnte nicht eingetragen werden.",
			async () => {
				const dayKey = await acceptPlan({ learningPlanId });
				setSuccessDayKey(dayKey);
			},
		);
	};

	const handlePickerChange = (
		event: DateTimePickerEvent,
		selectedDate?: Date,
	) => {
		if (Platform.OS === "android") setPickerTarget(null);
		if (event.type === "dismissed" || !selectedDate || !pickerTarget) return;

		if (pickerTarget === "editDate") setEditDate(startOfDay(selectedDate));
		if (pickerTarget === "editStart") setEditStart(formatTime(selectedDate));
		if (pickerTarget === "editEnd") setEditEnd(formatTime(selectedDate));
	};

	const renderPicker = () => {
		if (!pickerTarget) return null;

		const isDate = pickerTarget === "editDate";
		const value = isDate
			? editDate
			: dateWithTime(
					getDateKey(editDate),
					pickerTarget === "editStart" ? editStart : editEnd,
				);

		if (Platform.OS === "ios") {
			return (
				<View className="absolute inset-0 z-50 justify-end">
					<Pressable
						className="absolute inset-0 bg-black/30"
						onPress={() => setPickerTarget(null)}
					/>
					<View className="rounded-t-[32px] bg-white px-4 pt-3 pb-7">
						<View className="mb-1 flex-row justify-end">
							<TouchableOpacity
								onPress={() => setPickerTarget(null)}
								className="px-3 py-2"
							>
								<Text className="font-bold font-poppins text-16 text-primary">
									Fertig
								</Text>
							</TouchableOpacity>
						</View>
						<DateTimePicker
							value={value}
							mode={isDate ? "date" : "time"}
							display="spinner"
							onChange={handlePickerChange}
						/>
					</View>
				</View>
			);
		}

		return (
			<DateTimePicker
				value={value}
				mode={isDate ? "date" : "time"}
				display="default"
				onChange={handlePickerChange}
			/>
		);
	};

	const goBack = () => {
		if (step === "topic") {
			router.back();
			return;
		}
		if (step === "question" && questionIndex > 0) {
			setQuestionIndex((value) => value - 1);
			return;
		}
		setStep("topic");
	};

	return (
		<KeyboardAvoidingView
			className="flex-1 bg-[#F5F3F6]"
			behavior={Platform.OS === "ios" ? "padding" : "height"}
		>
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					paddingHorizontal: 32,
					paddingTop: 76,
					paddingBottom: 72,
				}}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<Header
					title={step === "plan" ? "Lernplan" : "Prüfungsthema"}
					onBack={goBack}
				/>

				{step === "topic" ? (
					<>
						<SectionTitle
							title="Lernplan erstellen"
							description="Beschreibe den Prüfungsinhalt und lade optional Schulmaterial hoch."
						/>
						<Text className="mb-3 font-bold font-poppins text-12 text-text">
							Thema beschreiben
						</Text>
						<View
							className="mb-6 min-h-[146px] items-start rounded-[28px] bg-white px-[18px] pt-[14px] pb-4"
							style={{
								borderWidth: 1,
								borderColor: "rgba(0,0,0,0.06)",
								shadowColor: "#000000",
								shadowOpacity: 0.05,
								shadowRadius: 10,
								shadowOffset: { width: 0, height: 4 },
								elevation: 2,
							}}
						>
							<Textarea
								value={topicDescription}
								onChangeText={setTopicDescription}
								placeholder="Kurze Beschreibung hinzufügen"
							/>
						</View>

						<Text className="mb-3 font-bold font-poppins text-12 text-text">
							Notizen
						</Text>
						<View className="mb-5 flex-row" style={{ columnGap: 12 }}>
							<UploadAction
								label="Foto aufnehmen"
								onPress={takePhoto}
								disabled={!canUploadMaterial}
								icon={
									isBusy ? (
										<ActivityIndicator color="#3A7BFF" />
									) : (
										<Camera size={24} color="#3A7BFF" strokeWidth={2.4} />
									)
								}
							/>
							<UploadAction
								label="Datei hochladen"
								onPress={uploadMaterial}
								disabled={!canUploadMaterial}
								icon={
									isBusy ? (
										<ActivityIndicator color="#3A7BFF" />
									) : (
										<Plus size={24} color="#3A7BFF" strokeWidth={2.6} />
									)
								}
							/>
						</View>

						{snapshot?.documents.map((document) => (
							<MaterialCard
								key={document.id}
								name={document.fileName}
								size={document.fileSizeBytes}
								onRemove={() => removeDocument({ id: document.id })}
							/>
						))}

						<View className="mb-7 min-h-[118px] items-start rounded-[24px] bg-white px-[18px] pt-[14px] pb-4">
							<Textarea
								value={notes}
								onChangeText={setNotes}
								placeholder="Optional: Was macht dir Sorgen, was kam im Unterricht dran?"
							/>
						</View>

						{errorMessage ? (
							<Text className="mb-4 font-poppins text-12 text-destructive">
								{errorMessage}
							</Text>
						) : null}
						<Button
							disabled={!canContinueTopic || isBusy}
							onPress={continueToAnalysis}
						>
							{isBusy ? (
								<ActivityIndicator color="#FFFFFF" />
							) : (
								<Text>Weiter</Text>
							)}
						</Button>
					</>
				) : null}

				{step === "analysisIntro" ? (
					<View className="flex-1 items-center pt-8">
						<View className="mb-10 h-[190px] w-[190px] items-center justify-center">
							{ANALYSIS_ORBITS.map((orbit) => (
								<View
									key={orbit.id}
									className="absolute h-[92px] w-[92px] rounded-full bg-primary/55"
									style={{
										transform: [
											{ rotate: `${orbit.rotation}deg` },
											{ translateY: -34 },
										],
									}}
								/>
							))}
						</View>
						<Text className="self-start font-bold font-poppins text-18 text-text">
							Beantworte 5 kurze Fragen für deinen persönlichen Lernplan.
						</Text>
						<Button
							className="mt-10 w-full"
							onPress={() => setStep("question")}
						>
							<Text>Starten</Text>
						</Button>
					</View>
				) : null}

				{step === "question" && currentQuestion ? (
					<>
						<View className="mb-7 items-center">
							<View className="h-16 w-16 items-center justify-center rounded-full bg-primary/55">
								<Text className="font-bold font-poppins text-20 text-white">
									{questionIndex + 1}
								</Text>
							</View>
						</View>
						<Text className="font-poppins text-12 text-text/45">
							Frage {questionIndex + 1} von {questions.length}
						</Text>
						<Text className="mt-2 font-bold font-poppins text-18 text-text">
							{currentQuestion.prompt}
						</Text>
						<Text className="mt-7 mb-3 font-bold font-poppins text-12 text-text">
							Antwort
						</Text>
						<View className="mb-8 min-h-[138px] items-start rounded-[28px] bg-white px-[18px] pt-[14px] pb-4">
							<Textarea
								value={answers[currentQuestion.id] ?? ""}
								onChangeText={(value) =>
									setAnswers((current) => ({
										...current,
										[currentQuestion.id]: value,
									}))
								}
								placeholder="Schreibe hier deine Antwort rein..."
							/>
						</View>
						{errorMessage ? (
							<Text className="mb-4 font-poppins text-12 text-destructive">
								{errorMessage}
							</Text>
						) : null}
						<Button
							disabled={!(answers[currentQuestion.id] ?? "").trim() || isBusy}
							onPress={continueQuestion}
						>
							{isBusy ? (
								<ActivityIndicator color="#FFFFFF" />
							) : (
								<Text>Weiter</Text>
							)}
						</Button>
					</>
				) : null}

				{step === "generating" ? (
					<View className="flex-1 items-center justify-center pt-24">
						<View className="mb-7 h-20 w-20 items-center justify-center rounded-full bg-primary/12">
							<Sparkles size={34} color="#3A7BFF" strokeWidth={2.2} />
						</View>
						<Text className="text-center font-bold font-poppins text-20 text-text">
							Dein Lernplan wird erstellt
						</Text>
						<Text className="mt-3 text-center font-poppins text-14 text-text/55">
							Dayova analysiert deine Antworten und das Material.
						</Text>
						<ActivityIndicator className="mt-8" color="#3A7BFF" />
						{errorMessage ? (
							<Button
								className="mt-8 w-full"
								onPress={() => setStep("question")}
							>
								<Text>Zurück</Text>
							</Button>
						) : null}
					</View>
				) : null}

				{step === "plan" ? (
					<>
						<SectionTitle
							title="Lernplan erstellen"
							description="Beschreibe den Prüfungsinhalt und lade optional Schulmaterial hoch."
						/>
						{snapshot?.sessions.map((session) => (
							<SessionCard
								key={session.id}
								session={session}
								onEdit={() => openEdit(session)}
							/>
						))}
						{snapshot?.plan.insight ? (
							<View className="mt-1 mb-5 rounded-[24px] bg-white/70 px-5 py-4">
								<Text className="font-bold font-poppins text-14 text-text">
									Strategie
								</Text>
								<Text className="mt-2 font-poppins text-14 text-text/60">
									{snapshot.plan.insight.strategy}
								</Text>
							</View>
						) : null}
						{errorMessage ? (
							<Text className="mb-4 font-poppins text-12 text-destructive">
								{errorMessage}
							</Text>
						) : null}
						<Button
							disabled={isBusy || !snapshot?.sessions.length}
							onPress={acceptGeneratedPlan}
						>
							{isBusy ? (
								<ActivityIndicator color="#FFFFFF" />
							) : (
								<>
									<Check size={18} color="#FFFFFF" strokeWidth={2.4} />
									<Text>Übernehmen</Text>
								</>
							)}
						</Button>
					</>
				) : null}
			</ScrollView>

			<Modal visible={Boolean(editingSession)} transparent animationType="fade">
				<View className="flex-1 justify-end">
					<Pressable
						className="absolute inset-0 bg-black/25"
						onPress={() => setEditingSession(null)}
					/>
					<View className="mx-5 mb-6 rounded-[32px] bg-[#F5F3F6] px-5 pt-5 pb-6">
						<Header
							title="Bearbeiten"
							onBack={() => setEditingSession(null)}
							right={
								<TouchableOpacity
									onPress={() =>
										editingSession && setDeleteSession(editingSession)
									}
									className="h-10 w-10 items-center justify-center rounded-full bg-white"
								>
									<Trash2 size={18} color="#FF5147" strokeWidth={2.3} />
								</TouchableOpacity>
							}
						/>
						<Text className="font-bold font-poppins text-16 text-text">
							{(editingSession?.sortOrder ?? 0) + 1}. Lerntag bearbeiten
						</Text>
						<Text className="mt-2 mb-5 font-poppins text-14 text-text/55">
							Hier kannst du individuell deinen Lernplan anpassen.
						</Text>

						<Text className="mb-3 font-bold font-poppins text-12 text-text">
							Lerndatum
						</Text>
						<TouchableOpacity
							onPress={() => setPickerTarget("editDate")}
							className="mb-3 h-14 flex-row items-center justify-between rounded-[28px] bg-white px-5"
						>
							<Text className="font-poppins text-14 text-text/55">
								{formatDate(editDate)}
							</Text>
							<CalendarDays size={18} color="#3A7BFF" strokeWidth={2.2} />
						</TouchableOpacity>
						<View className="mb-8 flex-row" style={{ columnGap: 8 }}>
							<TouchableOpacity
								onPress={() => setPickerTarget("editStart")}
								className="h-14 flex-1 flex-row items-center justify-between rounded-[28px] bg-white px-5"
							>
								<Text className="font-poppins text-14 text-text/55">
									{editStart}
								</Text>
								<Clock3 size={17} color="#A3A3A3" strokeWidth={2.1} />
							</TouchableOpacity>
							<TouchableOpacity
								onPress={() => setPickerTarget("editEnd")}
								className="h-14 flex-1 flex-row items-center justify-between rounded-[28px] bg-white px-5"
							>
								<Text className="font-poppins text-14 text-text/55">
									{editEnd}
								</Text>
								<Clock3 size={17} color="#A3A3A3" strokeWidth={2.1} />
							</TouchableOpacity>
						</View>

						<View className="flex-row" style={{ columnGap: 10 }}>
							<Button
								variant="secondary"
								className="flex-1 bg-black/5 shadow-none"
								onPress={() =>
									editingSession && setDeleteSession(editingSession)
								}
							>
								<Text className="text-text">Entfernen</Text>
							</Button>
							<Button className="flex-1" onPress={saveEdit} disabled={isBusy}>
								{isBusy ? (
									<ActivityIndicator color="#FFFFFF" />
								) : (
									<Text>Speichern</Text>
								)}
							</Button>
						</View>
					</View>
				</View>
			</Modal>

			<Modal visible={Boolean(deleteSession)} transparent animationType="fade">
				<View className="flex-1 justify-end">
					<Pressable
						className="absolute inset-0 bg-black/35"
						onPress={() => setDeleteSession(null)}
					/>
					<View className="mx-8 mb-9 items-center rounded-[30px] bg-white px-5 pt-7 pb-5">
						<View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-red-100">
							<X size={31} color="#FF5147" strokeWidth={1.8} />
						</View>
						<Text className="font-bold font-poppins text-18 text-text">
							Bist du dir sicher?
						</Text>
						<Text className="mt-2 text-center font-poppins text-12 text-text/45">
							Klicke auf Entfernen wenn du dir sicher bist den Lerntag zu
							Entfernen
						</Text>
						<View className="mt-6 flex-row" style={{ columnGap: 10 }}>
							<Button
								variant="secondary"
								className="flex-1 bg-black/5 shadow-none"
								onPress={() => setDeleteSession(null)}
							>
								<Text className="text-text">Abbrechen</Text>
							</Button>
							<Button
								className="flex-1"
								onPress={confirmDelete}
								disabled={isBusy}
							>
								<Text>Entfernen</Text>
							</Button>
						</View>
					</View>
				</View>
			</Modal>

			<Modal visible={Boolean(successDayKey)} transparent animationType="fade">
				<View className="flex-1 justify-end">
					<View className="absolute inset-0 bg-black/30" />
					<View className="mx-8 mb-9 items-center rounded-[30px] bg-white px-5 pt-8 pb-5">
						<View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-green-100">
							<Check size={31} color="#28C76F" strokeWidth={1.9} />
						</View>
						<Text className="font-bold font-poppins text-18 text-text">
							Lernplan ist eingetragen
						</Text>
						<Text className="mt-2 text-center font-poppins text-12 text-text/45">
							Deine Lernplan wurde erfolgreich eingetragen.
						</Text>
						<Button
							className="mt-6 w-full"
							onPress={() =>
								router.replace(
									`/home${successDayKey ? `?dayKey=${encodeURIComponent(successDayKey)}` : ""}`,
								)
							}
						>
							<Text>Fertig</Text>
						</Button>
					</View>
				</View>
			</Modal>

			{renderPicker()}
		</KeyboardAvoidingView>
	);
}
