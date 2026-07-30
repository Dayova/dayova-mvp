import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { fetch } from "expo/fetch";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import {
	ActionSheet,
	actionSheetIconColor,
} from "~/components/ui/action-sheet";
import { Attachment, ScanImage } from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { useAuthSession } from "~/context/AuthContext";
import { LEARNING_PLAN_CREATION_STEPS } from "~/features/learning-plans/creation-progress";
import { useLearningPlanCreationProgress } from "~/features/learning-plans/creation-progress-shell";
import {
	learningPlanStepPath,
	learningPlanTopicPath,
} from "~/features/learning-plans/creation-routes";
import {
	MaterialUploadStep,
	TeacherGuidanceStep,
} from "~/features/learning-plans/learning-plan-setup-steps";
import type {
	LearningPlanSnapshot,
	UploadAsset,
} from "~/features/learning-plans/types";
import {
	formatDate,
	getDateKey,
	getErrorMessage,
	getUploadFailureMessage,
	parseDateKey,
	retryOnceAfterAuthResume,
} from "~/features/learning-plans/utils";
import { useValidationAnalytics } from "~/lib/use-validation-analytics";
import { getValidationFileSizeBucket } from "~/lib/analytics";
import { logDiagnosticError } from "~/lib/diagnostics";
import { goBackOrReplace, useBackIntent } from "~/lib/navigation";
import { ROUTES, withReturnTo } from "~/lib/routes";
import { ACCEPTED_FILE_TYPES, validateUploadFile } from "~/lib/upload-policy";

const UPLOAD_TIMEOUT_MS = 45_000;
const UPLOAD_COMPLETION_FAILURE_MESSAGE =
	"Die Datei wurde übertragen, aber Dayova konnte den Upload nicht abschließen. Bitte versuche es erneut.";

type PreparedUploadAsset = {
	asset: UploadAsset;
	file: File;
	fileSizeBytes: number;
	fileType: string;
};

type PendingUploadAction = "camera" | "files";
type MaterialSourceKind = "school" | "external";
type PendingUploadRequest = {
	action: PendingUploadAction;
	sourceKind: MaterialSourceKind;
};
type LearningPlanSetupStep = "materialUpload" | "teacherGuidance";

export default function NewLearningPlanScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{
		step?: string;
		learningPlanId?: string;
		examDayEntryId?: string;
		subject?: string;
		examTypeLabel?: string;
		examDateKey?: string;
		examDateLabel?: string;
		durationMinutes?: string;
		topicDescription?: string;
		teacherGuidance?: string;
		errorMessage?: string;
	}>();
	const { user } = useAuthSession();
	const { capture } = useValidationAnalytics();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const createDraftPlan = useMutation(api.learningPlans.createDraft);
	const updateExamEvidence = useMutation(api.learningPlans.updateExamEvidence);
	const generateUploadUrl = useMutation(api.learningPlans.generateUploadUrl);
	const registerUploadedDocument = useAction(
		api.learningPlans.registerUploadedDocument,
	);
	const removeDocument = useMutation(api.learningPlans.removeDocument);

	const subject = params.subject?.trim() || "Fach";
	const examTypeLabel = params.examTypeLabel?.trim() || "Leistungskontrolle";
	const examDateKey = params.examDateKey || getDateKey(new Date());
	const examDateLabel =
		params.examDateLabel || formatDate(parseDateKey(examDateKey));
	const durationMinutes = Number(params.durationMinutes ?? 45) || 45;
	const examDayEntryId = params.examDayEntryId as Id<"dayEntries"> | undefined;
	const initialLearningPlanId = params.learningPlanId as
		| Id<"learningPlans">
		| undefined;

	const [learningPlanId, setLearningPlanId] =
		useState<Id<"learningPlans"> | null>(initialLearningPlanId ?? null);
	const [setupStep, setSetupStep] = useState<LearningPlanSetupStep>(() =>
		params.step === "topic" || params.errorMessage
			? "teacherGuidance"
			: "materialUpload",
	);
	const [teacherGuidanceInput, setTeacherGuidanceInput] = useState<
		string | null
	>(params.teacherGuidance ?? params.topicDescription ?? null);
	const [isBusy, setIsBusy] = useState(false);
	const [isUploadSheetVisible, setIsUploadSheetVisible] = useState(false);
	const [uploadSourceKind, setUploadSourceKind] =
		useState<MaterialSourceKind>("school");
	const pendingUploadRequestRef = useRef<PendingUploadRequest | null>(null);
	const [openingUploadAction, setOpeningUploadAction] =
		useState<PendingUploadAction | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(
		params.errorMessage ?? null,
	);

	const hasExamEntry = Boolean(examDayEntryId || learningPlanId);
	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && learningPlanId
			? { id: learningPlanId }
			: "skip",
	) ?? null) as LearningPlanSnapshot | null;
	const learningTimes = useQuery(
		api.learningTimes.listMine,
		user && isConvexAuthenticated && learningPlanId ? {} : "skip",
	);
	const canWrite = Boolean(user && isConvexAuthenticated);
	const teacherGuidance =
		teacherGuidanceInput ??
		snapshot?.plan.teacherGuidance ??
		snapshot?.plan.topicDescription ??
		"";
	const hasSchoolMaterial = Boolean(
		snapshot?.documents.some((document) => document.sourceKind === "school"),
	);
	const canContinueUpload = canWrite && !isBusy && !openingUploadAction;
	const canContinueEvidence =
		Boolean(learningPlanId) &&
		(hasSchoolMaterial || teacherGuidance.trim().length >= 8) &&
		canWrite &&
		!isBusy;
	const showLearningTimesWarning =
		learningTimes !== undefined && learningTimes.length === 0;
	const currentProgressStep =
		setupStep === "materialUpload"
			? LEARNING_PLAN_CREATION_STEPS.materialUpload
			: LEARNING_PLAN_CREATION_STEPS.examEvidence;

	useEffect(() => {
		if (!hasExamEntry) {
			router.replace(ROUTES.createExam);
		}
	}, [hasExamEntry, router]);

	useEffect(() => {
		if (params.step === "topic" || params.errorMessage) {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- Route params can change while this screen remains mounted.
			setSetupStep("teacherGuidance");
		}
		if (params.errorMessage) {
			setErrorMessage(params.errorMessage);
		}
	}, [params.errorMessage, params.step]);

	const ensurePlan = async () => {
		if (learningPlanId) {
			return learningPlanId;
		}

		if (!examDayEntryId) {
			throw new Error("Erstelle zuerst eine Prüfung.");
		}

		const id = await retryOnceAfterAuthResume(() =>
			createDraftPlan({
				examDayEntryId,
				subject,
				examTypeLabel,
				examDateKey,
				examDateLabel,
				durationMinutes,
				topicDescription: params.topicDescription ?? "",
				notes: "",
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

	const prepareUploadAsset = (asset: UploadAsset): PreparedUploadAsset => {
		const file = new File(asset.uri);
		const fileSizeBytes = asset.size ?? file.info().size ?? 0;
		const fileType = asset.mimeType || "application/octet-stream";

		const validation = validateUploadFile({
			name: asset.name,
			size: fileSizeBytes,
		});
		if (!validation.valid) throw new Error(validation.message);

		return { asset, file, fileSizeBytes, fileType };
	};

	const uploadLearningPlanAsset = async (
		preparedAsset: PreparedUploadAsset,
		sourceKind: MaterialSourceKind,
		existingLearningPlanId?: Id<"learningPlans">,
	) => {
		const id = existingLearningPlanId ?? (await ensurePlan());
		const { asset, file, fileSizeBytes, fileType } = preparedAsset;

		const uploadData = await retryOnceAfterAuthResume(() =>
			generateUploadUrl({ learningPlanId: id }),
		);
		const uploadController = new AbortController();
		const uploadTimeout = setTimeout(
			() => uploadController.abort(),
			UPLOAD_TIMEOUT_MS,
		);
		let uploadResponse: Response;
		try {
			uploadResponse = await fetch(uploadData.uploadUrl, {
				method: uploadData.storageProvider === "r2" ? "PUT" : "POST",
				headers: { "Content-Type": fileType },
				body: file,
				signal: uploadController.signal,
			});
		} catch (error) {
			if (
				error instanceof Error &&
				(error.name === "AbortError" || uploadController.signal.aborted)
			) {
				throw new Error(
					"Der Upload hat zu lange gedauert. Prüfe deine Verbindung und versuche es erneut.",
				);
			}
			throw error;
		} finally {
			clearTimeout(uploadTimeout);
		}

		const uploadResponseBody = await uploadResponse.text();
		if (!uploadResponse.ok) {
			throw new Error(
				getUploadFailureMessage(
					uploadData.storageProvider,
					uploadResponse,
					uploadResponseBody,
				),
			);
		}

		let storageId = uploadData.storageId;
		if (!storageId) {
			let parsedUploadResult: { storageId?: string } | null = null;
			let uploadResponseParseError: unknown = null;
			let parseErrorMessage: string | null = null;
			try {
				parsedUploadResult = JSON.parse(uploadResponseBody) as {
					storageId?: string;
				};
			} catch (error) {
				uploadResponseParseError = error;
				parseErrorMessage =
					error instanceof Error ? error.message : "Unbekannter JSON-Fehler";
			}
			storageId = parsedUploadResult?.storageId ?? null;
			if (!storageId) {
				const responseHeaders: Record<string, string> = {};
				uploadResponse.headers.forEach((value, key) => {
					responseHeaders[key] = value;
				});

				logDiagnosticError(
					"Upload response did not provide a storageId.",
					uploadResponseParseError ??
						new Error("Storage provider response did not include storageId."),
					{
						source: "learning-plans",
						metadata: {
							learningPlanId: id,
							storageProvider: uploadData.storageProvider,
							uploadMethod:
								uploadData.storageProvider === "r2" ? "PUT" : "POST",
							responseStatus: uploadResponse.status,
							responseStatusText: uploadResponse.statusText,
							responseHeaders,
							responseBody: uploadResponseBody || null,
							responseBodyLength: uploadResponseBody.length,
							parseErrorMessage,
							parsedUploadResult,
							fileName: asset.name,
							fileType,
							fileSizeBytes,
						},
					},
				);
				throw new Error(UPLOAD_COMPLETION_FAILURE_MESSAGE);
			}
		}

		await retryOnceAfterAuthResume(() =>
			registerUploadedDocument({
				learningPlanId: id,
				uploadToken: uploadData.uploadToken,
				storageId,
				fileName: asset.name,
				fileType,
				fileSizeBytes,
				sourceKind,
			}),
		);
		const analyticsFileType =
			ACCEPTED_FILE_TYPES.find((allowedType) => allowedType === fileType) ??
			"application/octet-stream";
		void capture("material_uploaded", {
			learning_plan_id: id,
			file_type: analyticsFileType,
			file_size_bucket: getValidationFileSizeBucket(fileSizeBytes),
		});
	};

	const uploadMaterial = async (sourceKind: MaterialSourceKind) => {
		if (!canWrite || isBusy) {
			setOpeningUploadAction(null);
			return;
		}

		setErrorMessage(null);
		try {
			const result = await DocumentPicker.getDocumentAsync({
				type: [...ACCEPTED_FILE_TYPES],
				multiple: true,
				copyToCacheDirectory: true,
			});
			setOpeningUploadAction(null);
			if (result.canceled) return;

			await runWithErrorHandling(
				"Die Datei konnte nicht hochgeladen werden.",
				async () => {
					const preparedAssets = result.assets.map((asset) =>
						prepareUploadAsset({
							uri: asset.uri,
							name: asset.name,
							mimeType: asset.mimeType,
							size: asset.size,
						}),
					);
					const id = await ensurePlan();

					for (const asset of preparedAssets) {
						await uploadLearningPlanAsset(asset, sourceKind, id);
					}
				},
			);
		} catch (error) {
			setErrorMessage(
				getErrorMessage(
					error,
					"Die Dateiauswahl konnte nicht geöffnet werden.",
				),
			);
		} finally {
			setOpeningUploadAction(null);
		}
	};

	const takePhoto = async (sourceKind: MaterialSourceKind) => {
		if (!canWrite || isBusy) {
			setOpeningUploadAction(null);
			return;
		}

		setErrorMessage(null);
		try {
			const permission = await ImagePicker.requestCameraPermissionsAsync();
			if (!permission.granted) {
				throw new Error("Kamerazugriff wurde nicht erlaubt.");
			}

			const result = await ImagePicker.launchCameraAsync({
				mediaTypes: ["images"],
				allowsEditing: false,
				quality: 0.82,
			});
			setOpeningUploadAction(null);
			if (result.canceled) return;

			const asset = result.assets[0];
			if (!asset) return;

			await runWithErrorHandling(
				"Das Foto konnte nicht hochgeladen werden.",
				async () => {
					await uploadLearningPlanAsset(
						prepareUploadAsset({
							uri: asset.uri,
							name: asset.fileName ?? `mitschrift-${Date.now()}.jpg`,
							mimeType: asset.mimeType ?? "image/jpeg",
							size: asset.fileSize,
						}),
						sourceKind,
					);
				},
			);
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "Die Kamera konnte nicht geöffnet werden."),
			);
		} finally {
			setOpeningUploadAction(null);
		}
	};

	const closeUploadSheet = () => {
		pendingUploadRequestRef.current = null;
		setOpeningUploadAction(null);
		setIsUploadSheetVisible(false);
	};

	const runUploadAction = (
		action: PendingUploadAction,
		sourceKind: MaterialSourceKind,
	) => {
		if (action === "files") {
			void uploadMaterial(sourceKind);
		} else {
			void takePhoto(sourceKind);
		}
	};

	const chooseUploadAction = (action: PendingUploadAction) => {
		setOpeningUploadAction(action);
		setIsUploadSheetVisible(false);

		if (process.env.EXPO_OS === "ios") {
			pendingUploadRequestRef.current = {
				action,
				sourceKind: uploadSourceKind,
			};
			return;
		}

		pendingUploadRequestRef.current = null;
		runUploadAction(action, uploadSourceKind);
	};

	const runPendingUploadAction = () => {
		const request = pendingUploadRequestRef.current;
		pendingUploadRequestRef.current = null;
		if (!request) return;

		runUploadAction(request.action, request.sourceKind);
	};

	const continueToEvidence = async () => {
		if (!canContinueUpload) return;

		await runWithErrorHandling(
			"Der Lernplan konnte nicht vorbereitet werden.",
			async () => {
				const id = await ensurePlan();
				router.setParams({ learningPlanId: id, step: "topic" });
				setSetupStep("teacherGuidance");
			},
		);
	};

	const goBack = () => {
		if (setupStep === "teacherGuidance") {
			setErrorMessage(null);
			router.setParams({ errorMessage: undefined, step: undefined });
			setSetupStep("materialUpload");
			return true;
		}

		goBackOrReplace(router, ROUTES.createExam);
		return true;
	};

	useBackIntent(setupStep === "teacherGuidance", goBack);
	useLearningPlanCreationProgress({
		active: true,
		currentStep: currentProgressStep,
		onBack: goBack,
	});

	const continueToAnalysis = async () => {
		if (!learningPlanId || !canContinueEvidence) return;

		setIsBusy(true);
		setErrorMessage(null);
		router.setParams({ errorMessage: undefined });
		try {
			await retryOnceAfterAuthResume(() =>
				updateExamEvidence({
					id: learningPlanId,
					teacherGuidance,
				}),
			);
			router.push(learningPlanStepPath(learningPlanId, "analysis"));
		} catch (error) {
			setErrorMessage(
				getErrorMessage(
					error,
					"Die Information deiner Lehrkraft konnte nicht gespeichert werden.",
				),
			);
		} finally {
			setIsBusy(false);
		}
	};

	const openLearningTimes = () => {
		if (!learningPlanId) return;
		router.replace(
			withReturnTo(
				ROUTES.learningTimes,
				learningPlanTopicPath(learningPlanId, { teacherGuidance }),
			),
		);
	};

	if (!hasExamEntry) return null;

	return (
		<Screen>
			<Stack.Screen options={{ gestureEnabled: true }} />
			<ScreenScroll
				key={setupStep}
				includeTopSafeArea={false}
				topPadding={0}
				contentContainerStyle={{ flexGrow: 1 }}
			>
				<View key={setupStep} className="flex-1">
					{setupStep === "materialUpload" ? (
						<MaterialUploadStep
							canContinue={canContinueUpload}
							documents={snapshot?.documents ?? []}
							errorMessage={errorMessage}
							isBusy={isBusy}
							onContinue={() => void continueToEvidence()}
							onOpenUpload={(sourceKind) => {
								setUploadSourceKind(sourceKind);
								setIsUploadSheetVisible(true);
							}}
							onRemoveDocument={(id) => void removeDocument({ id })}
							openingUploadAction={openingUploadAction}
						/>
					) : (
						<TeacherGuidanceStep
							canContinue={canContinueEvidence}
							errorMessage={errorMessage}
							hasSchoolMaterial={hasSchoolMaterial}
							isBusy={isBusy}
							onChangeTeacherGuidance={setTeacherGuidanceInput}
							onContinue={() => void continueToAnalysis()}
							onOpenLearningTimes={openLearningTimes}
							showLearningTimesWarning={showLearningTimesWarning}
							teacherGuidance={teacherGuidance}
						/>
					)}
				</View>
			</ScreenScroll>

			<ActionSheet
				visible={setupStep === "materialUpload" && isUploadSheetVisible}
				title={
					uploadSourceKind === "school"
						? "Material von deiner Schule"
						: "Zusätzliche Lernhilfe"
				}
				description={
					uploadSourceKind === "school"
						? "Scanne oder lade Unterlagen deiner Schule oder Lehrkraft hoch."
						: "Lade eine zusätzliche Erklärung oder Lernhilfe hoch."
				}
				onClose={closeUploadSheet}
				onDismiss={runPendingUploadAction}
				closeAccessibilityLabel="Hochladen schließen"
				layout="tile"
				onSelect={chooseUploadAction}
				options={[
					{
						value: "camera",
						title: "Scannen",
						disabled: !canContinueUpload,
						icon:
							openingUploadAction === "camera" || isBusy ? (
								<ActivityIndicator color={actionSheetIconColor} />
							) : (
								<ScanImage
									size={28}
									color={actionSheetIconColor}
									strokeWidth={1.8}
								/>
							),
					},
					{
						value: "files",
						title: "Dateien",
						disabled: !canContinueUpload,
						icon:
							openingUploadAction === "files" || isBusy ? (
								<ActivityIndicator color={actionSheetIconColor} />
							) : (
								<Attachment
									size={28}
									color={actionSheetIconColor}
									strokeWidth={1.8}
								/>
							),
					},
				]}
			/>
		</Screen>
	);
}
