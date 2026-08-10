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
	examEntrySuccessPath,
	learningPlanStepPath,
} from "~/features/learning-plans/creation-routes";
import {
	getInitialLearningPlanSetupStep,
	getPreviousLearningPlanSetupStep,
	type LearningPlanSetupStep,
} from "~/features/learning-plans/learning-plan-setup-flow";
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
import { getValidationFileSizeBucket } from "~/lib/analytics";
import { logDiagnosticError } from "~/lib/diagnostics";
import {
	dismissToOrReplace,
	goBackOrReplace,
	useBackIntent,
} from "~/lib/navigation";
import { ROUTES } from "~/lib/routes";
import { ACCEPTED_FILE_TYPES, validateUploadFile } from "~/lib/upload-policy";
import { useValidationAnalytics } from "~/lib/use-validation-analytics";

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
type PendingUploadRequest = {
	action: PendingUploadAction;
};

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
		getInitialLearningPlanSetupStep({
			hasError: Boolean(params.errorMessage),
			routeStep: params.step,
		}),
	);
	const [teacherGuidanceInput, setTeacherGuidanceInput] = useState<
		string | null
	>(params.teacherGuidance ?? params.topicDescription ?? null);
	const [isBusy, setIsBusy] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [isUploadSheetVisible, setIsUploadSheetVisible] = useState(false);
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
	const canWrite = Boolean(user && isConvexAuthenticated);
	const teacherGuidance =
		teacherGuidanceInput ??
		snapshot?.plan.teacherGuidance ??
		snapshot?.plan.topicDescription ??
		"";
	const hasSchoolMaterial = Boolean(
		snapshot?.documents.some((document) => document.sourceKind === "school"),
	);
	const isPlanSnapshotLoading = Boolean(learningPlanId && snapshot === null);
	const canUpload =
		canWrite && !isBusy && !openingUploadAction && !isPlanSnapshotLoading;
	const canContinueGuidance = canWrite && !isBusy && !isPlanSnapshotLoading;
	const canContinueUpload =
		Boolean(learningPlanId) && hasSchoolMaterial && canUpload;
	const currentProgressStep =
		setupStep === "teacherGuidance"
			? LEARNING_PLAN_CREATION_STEPS.teacherGuidance
			: LEARNING_PLAN_CREATION_STEPS.materialUpload;

	useEffect(() => {
		if (!hasExamEntry) {
			router.replace(ROUTES.createExam);
		}
	}, [hasExamEntry, router]);

	useEffect(() => {
		if (params.step === "material" || params.errorMessage) {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- Route params can change while this screen remains mounted.
			setSetupStep("materialUpload");
		} else if (params.step === "topic") {
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
				sourceKind: "school",
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

	const uploadMaterial = async () => {
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

			setIsUploading(true);
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
						await uploadLearningPlanAsset(asset, id);
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
			setIsUploading(false);
			setOpeningUploadAction(null);
		}
	};

	const takePhoto = async () => {
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

			setIsUploading(true);
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
					);
				},
			);
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "Die Kamera konnte nicht geöffnet werden."),
			);
		} finally {
			setIsUploading(false);
			setOpeningUploadAction(null);
		}
	};

	const closeUploadSheet = () => {
		pendingUploadRequestRef.current = null;
		setOpeningUploadAction(null);
		setIsUploadSheetVisible(false);
	};

	const runUploadAction = (action: PendingUploadAction) => {
		if (action === "files") {
			void uploadMaterial();
		} else {
			void takePhoto();
		}
	};

	const chooseUploadAction = (action: PendingUploadAction) => {
		setOpeningUploadAction(action);
		setIsUploadSheetVisible(false);

		if (process.env.EXPO_OS === "ios") {
			pendingUploadRequestRef.current = { action };
			return;
		}

		pendingUploadRequestRef.current = null;
		runUploadAction(action);
	};

	const runPendingUploadAction = () => {
		const request = pendingUploadRequestRef.current;
		pendingUploadRequestRef.current = null;
		if (!request) return;

		runUploadAction(request.action);
	};

	const continueToMaterial = () => {
		if (!canContinueGuidance) return;

		void runWithErrorHandling(
			"Der Hinweis deiner Lehrkraft konnte nicht gespeichert werden.",
			async () => {
				const id = await ensurePlan();
				await retryOnceAfterAuthResume(() =>
					updateExamEvidence({
						id,
						teacherGuidance,
					}),
				);
				router.setParams({
					errorMessage: undefined,
					learningPlanId: id,
					step: "material",
				});
				setSetupStep("materialUpload");
			},
		);
	};

	const finishWithoutPlan = () => {
		void runWithErrorHandling(
			"Die Prüfung konnte nicht ohne Lernplan abgeschlossen werden.",
			async () => {
				if (!examDayEntryId) throw new Error("Prüfung nicht gefunden.");
				await ensurePlan();
				router.replace(
					examEntrySuccessPath({
						dayKey: examDateKey,
						examDateLabel,
					}),
				);
			},
		);
	};

	const goBack = () => {
		const previousSetupStep = getPreviousLearningPlanSetupStep(setupStep);
		if (previousSetupStep) {
			setErrorMessage(null);
			router.setParams({ errorMessage: undefined, step: "topic" });
			setSetupStep(previousSetupStep);
			return true;
		}

		if (examDayEntryId) {
			dismissToOrReplace(router, `/entry/${examDayEntryId}`);
			return true;
		}
		if (initialLearningPlanId) {
			goBackOrReplace(router, ROUTES.learningPlans);
			return true;
		}

		goBackOrReplace(router, ROUTES.createExam);
		return true;
	};

	useBackIntent(
		Boolean(
			examDayEntryId || initialLearningPlanId || setupStep === "materialUpload",
		),
		goBack,
	);
	useLearningPlanCreationProgress({
		active: true,
		currentStep: currentProgressStep,
		onBack: goBack,
	});

	const continueToAnalysis = () => {
		if (!learningPlanId || !canContinueUpload) return;

		setErrorMessage(null);
		router.setParams({ errorMessage: undefined });
		router.push(learningPlanStepPath(learningPlanId, "analysis"));
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
					{setupStep === "teacherGuidance" ? (
						<TeacherGuidanceStep
							canContinue={canContinueGuidance}
							errorMessage={errorMessage}
							isBusy={isBusy}
							onChangeTeacherGuidance={setTeacherGuidanceInput}
							onContinue={continueToMaterial}
							teacherGuidance={teacherGuidance}
						/>
					) : (
						<MaterialUploadStep
							canUpload={canUpload}
							canContinue={canContinueUpload}
							documents={snapshot?.documents ?? []}
							errorMessage={errorMessage}
							isBusy={isBusy}
							isUploading={isUploading}
							onContinue={continueToAnalysis}
							onOpenUpload={() => setIsUploadSheetVisible(true)}
							onRemoveDocument={(id) => void removeDocument({ id })}
							onSkip={finishWithoutPlan}
							openingUploadAction={openingUploadAction}
							showSkip={!initialLearningPlanId}
						/>
					)}
				</View>
			</ScreenScroll>

			<ActionSheet
				visible={isUploadSheetVisible}
				title="Material von deiner Schule"
				description="Scanne oder lade Unterlagen deiner Schule oder Lehrkraft hoch."
				onClose={closeUploadSheet}
				onDismiss={runPendingUploadAction}
				closeAccessibilityLabel="Hochladen schließen"
				layout="tile"
				onSelect={chooseUploadAction}
				options={[
					{
						value: "camera",
						title: "Scannen",
						disabled: !canUpload,
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
						disabled: !canUpload,
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
