import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { fetch } from "expo/fetch";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, useWindowDimensions } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
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
	TopicDescriptionStep,
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
import { useValidationAnalytics } from "~/lib/analytics";
import { definedAnalyticsProperties } from "~/lib/analytics-core";
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
type LearningPlanSetupStep = "materialUpload" | "topicDescription";

export default function NewLearningPlanScreen() {
	const router = useRouter();
	const { width: windowWidth } = useWindowDimensions();
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
		errorMessage?: string;
	}>();
	const { user } = useAuthSession();
	const { capture } = useValidationAnalytics();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const createDraftPlan = useMutation(api.learningPlans.createDraft);
	const updateBasics = useMutation(api.learningPlans.updateBasics);
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
			? "topicDescription"
			: "materialUpload",
	);
	const [topicDescriptionInput, setTopicDescriptionInput] = useState<
		string | null
	>(params.topicDescription ?? null);
	const [isBusy, setIsBusy] = useState(false);
	const [isUploadSheetVisible, setIsUploadSheetVisible] = useState(false);
	const pendingUploadActionRef = useRef<PendingUploadAction | null>(null);
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
	const topicDescription =
		topicDescriptionInput ?? snapshot?.plan.topicDescription ?? "";
	const canContinueUpload = canWrite && !isBusy && !openingUploadAction;
	const canContinueTopic =
		Boolean(learningPlanId) &&
		topicDescription.trim().length >= 8 &&
		canWrite &&
		!isBusy;
	const showLearningTimesWarning =
		learningTimes !== undefined && learningTimes.length === 0;
	const currentProgressStep =
		setupStep === "materialUpload"
			? LEARNING_PLAN_CREATION_STEPS.materialUpload
			: LEARNING_PLAN_CREATION_STEPS.topicDescription;
	const uploadArtworkWidth = Math.min(Math.max(windowWidth - 64, 240), 345);
	const uploadArtworkHeight = (uploadArtworkWidth * 313) / 345;

	useEffect(() => {
		if (!hasExamEntry) {
			router.replace(ROUTES.createExam);
		}
	}, [hasExamEntry, router]);

	useEffect(() => {
		if (params.step === "topic" || params.errorMessage) {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- Route params can change while this screen remains mounted.
			setSetupStep("topicDescription");
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
			}),
		);
		void capture(
			"material_uploaded",
			definedAnalyticsProperties({
				learning_plan_id: id,
				file_type: fileType,
				file_size_bytes: fileSizeBytes,
			}),
		);
	};

	const uploadMaterial = async () => {
		if (!canWrite || isBusy) {
			setOpeningUploadAction(null);
			return;
		}

		setErrorMessage(null);
		try {
			const result = await DocumentPicker.getDocumentAsync({
				type: ACCEPTED_FILE_TYPES,
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
			setOpeningUploadAction(null);
		}
	};

	const closeUploadSheet = () => {
		pendingUploadActionRef.current = null;
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
			pendingUploadActionRef.current = action;
			return;
		}

		pendingUploadActionRef.current = null;
		runUploadAction(action);
	};

	const runPendingUploadAction = () => {
		const action = pendingUploadActionRef.current;
		pendingUploadActionRef.current = null;
		if (!action) return;

		runUploadAction(action);
	};

	const continueToTopic = async () => {
		if (!canContinueUpload) return;

		await runWithErrorHandling(
			"Der Lernplan konnte nicht vorbereitet werden.",
			async () => {
				const id = await ensurePlan();
				router.setParams({ learningPlanId: id, step: "topic" });
				setSetupStep("topicDescription");
			},
		);
	};

	const goBack = () => {
		if (setupStep === "topicDescription") {
			setErrorMessage(null);
			router.setParams({ errorMessage: undefined, step: undefined });
			setSetupStep("materialUpload");
			return true;
		}

		goBackOrReplace(router, ROUTES.createExam);
		return true;
	};

	useBackIntent(setupStep === "topicDescription", goBack);
	useLearningPlanCreationProgress({
		active: true,
		currentStep: currentProgressStep,
		onBack: goBack,
	});

	const continueToAnalysis = async () => {
		if (!learningPlanId || !canContinueTopic) return;

		setIsBusy(true);
		setErrorMessage(null);
		router.setParams({ errorMessage: undefined });
		try {
			await retryOnceAfterAuthResume(() =>
				updateBasics({
					id: learningPlanId,
					topicDescription,
					notes: "",
				}),
			);
			router.push(learningPlanStepPath(learningPlanId, "analysis"));
		} catch (error) {
			setErrorMessage(
				getErrorMessage(
					error,
					"Das Prüfungsthema konnte nicht gespeichert werden.",
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
				learningPlanTopicPath(learningPlanId, { topicDescription }),
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
					<Animated.View
						key={setupStep}
						entering={FadeIn.duration(180)}
						className="flex-1"
					>
						{setupStep === "materialUpload" ? (
						<MaterialUploadStep
							artworkHeight={uploadArtworkHeight}
							artworkWidth={uploadArtworkWidth}
							canContinue={canContinueUpload}
							documents={snapshot?.documents ?? []}
							errorMessage={errorMessage}
							isBusy={isBusy}
							onContinue={() => void continueToTopic()}
							onOpenUpload={() => setIsUploadSheetVisible(true)}
							onRemoveDocument={(id) => void removeDocument({ id })}
							openingUploadAction={openingUploadAction}
						/>
					) : (
						<TopicDescriptionStep
							canContinue={canContinueTopic}
							errorMessage={errorMessage}
							isBusy={isBusy}
							onChangeTopicDescription={setTopicDescriptionInput}
							onContinue={() => void continueToAnalysis()}
							onOpenLearningTimes={openLearningTimes}
							showLearningTimesWarning={showLearningTimesWarning}
							topicDescription={topicDescription}
						/>
					)}
				</Animated.View>
			</ScreenScroll>

				<ActionSheet
					visible={setupStep === "materialUpload" && isUploadSheetVisible}
					title="Was möchtest du hochladen?"
					description="Lade hier deine Unterlagen hoch oder scanne sie ganz einfach."
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
