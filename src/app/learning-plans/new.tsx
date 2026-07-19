import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { fetch } from "expo/fetch";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { type ComponentType, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from "react-native";
import type { SvgProps } from "react-native-svg";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import IntroUploadSvg from "../../../assets/onboarding/intro-upload.svg";
import {
	BottomModal,
	BottomModalOption,
	bottomModalIconColor,
} from "~/components/ui/bottom-modal";
import { Button } from "~/components/ui/button";
import { Attachment, ScanImage } from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { useAuth } from "~/context/AuthContext";
import { LEARNING_PLAN_CREATION_STEPS } from "~/features/learning-plans/creation-progress";
import { LearningPlanCreationProgressHeader } from "~/features/learning-plans/creation-progress-header";
import { learningPlanTopicPath } from "~/features/learning-plans/creation-routes";
import { MaterialCard } from "~/features/learning-plans/learning-plan-ui";
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
import { goBackOrReplace } from "~/lib/navigation";
import { ROUTES } from "~/lib/routes";
import { ACCEPTED_FILE_TYPES, validateUploadFile } from "~/lib/upload-policy";

const UPLOAD_TIMEOUT_MS = 45_000;
const UPLOAD_COMPLETION_FAILURE_MESSAGE =
	"Die Datei wurde übertragen, aber Dayova konnte den Upload nicht abschließen. Bitte versuche es erneut.";
const IntroUploadArtwork = IntroUploadSvg as unknown as ComponentType<SvgProps>;

type PreparedUploadAsset = {
	asset: UploadAsset;
	file: File;
	fileSizeBytes: number;
	fileType: string;
};

type PendingUploadAction = "camera" | "files";

export default function NewLearningPlanScreen() {
	const router = useRouter();
	const { width: windowWidth } = useWindowDimensions();
	const params = useLocalSearchParams<{
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
	const { user } = useAuth();
	const { capture } = useValidationAnalytics();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const createDraftPlan = useMutation(api.learningPlans.createDraft);
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
	const canWrite = Boolean(user && isConvexAuthenticated);
	const canUploadMaterial = canWrite && !isBusy && !openingUploadAction;
	const canContinue = canWrite && !isBusy && !openingUploadAction;
	const uploadArtworkWidth = Math.min(Math.max(windowWidth - 64, 240), 345);
	const uploadArtworkHeight = (uploadArtworkWidth * 313) / 345;

	useEffect(() => {
		if (!hasExamEntry) {
			router.replace(ROUTES.createExam);
		}
	}, [hasExamEntry, router]);

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
		if (!action) {
			setOpeningUploadAction(null);
			return;
		}

		runUploadAction(action);
	};

	const continueToTopic = async () => {
		if (!canContinue) return;

		await runWithErrorHandling(
			"Der Lernplan konnte nicht vorbereitet werden.",
			async () => {
				const id = await ensurePlan();
				router.push(learningPlanTopicPath(id));
			},
		);
	};

	const goBack = () => {
		goBackOrReplace(router, ROUTES.createExam);
	};

	if (!hasExamEntry) return null;

	return (
		<Screen>
			<Stack.Screen options={{ gestureEnabled: true }} />
			<ThemedStatusBar />
			<ScreenScroll contentContainerStyle={{ flexGrow: 1 }}>
				<LearningPlanCreationProgressHeader
					currentStep={LEARNING_PLAN_CREATION_STEPS.materialUpload}
					onBack={goBack}
				/>
				<View className="flex-1 items-center pt-8">
					<TouchableOpacity
						accessibilityHint="Öffnet die Auswahl zum Scannen oder Hochladen von Dateien."
						accessibilityLabel="Schulmaterial hinzufügen"
						accessibilityRole="button"
						accessibilityState={{ disabled: !canUploadMaterial }}
						activeOpacity={0.86}
						disabled={!canUploadMaterial}
						onPress={() => setIsUploadSheetVisible(true)}
						className="relative overflow-hidden rounded-[32px]"
						style={{
							// The SVG follows the Figma artwork's fixed aspect ratio while
							// adapting to the runtime viewport width. Continuous corner
							// rendering is a native-only property without a NativeWind utility.
							width: uploadArtworkWidth,
							height: uploadArtworkHeight,
							borderCurve: "continuous",
						}}
					>
						<IntroUploadArtwork
							width={uploadArtworkWidth}
							height={uploadArtworkHeight}
						/>
						{isBusy || openingUploadAction ? (
							<View className="absolute inset-0 items-center justify-center rounded-[32px] bg-white/80">
								<ActivityIndicator color="#00A0E6" />
								<Text className="mt-3 font-poppins text-body-4 text-secondary-text">
									{openingUploadAction === "files"
										? "Dateiauswahl wird geöffnet …"
										: openingUploadAction === "camera"
											? "Kamera wird geöffnet …"
											: "Material wird hochgeladen …"}
								</Text>
							</View>
						) : null}
					</TouchableOpacity>

					<View className="mt-6 w-full">
						{snapshot?.documents.map((document) => (
							<MaterialCard
								key={document.id}
								name={document.fileName}
								size={document.fileSizeBytes}
								onRemove={() => removeDocument({ id: document.id })}
							/>
						))}
					</View>

					{errorMessage ? (
						<Text
							selectable
							accessibilityRole="alert"
							className="mb-4 w-full font-poppins text-body-4 text-destructive"
						>
							{errorMessage}
						</Text>
					) : null}
					<View className="mt-auto w-full pt-8">
						<Button
							accessibilityLabel={isBusy ? "Weiter, wird geladen" : "Weiter"}
							accessibilityLiveRegion={isBusy ? "polite" : undefined}
							accessibilityState={{
								busy: isBusy,
								disabled: !canContinue,
							}}
							disabled={!canContinue}
							onPress={() => void continueToTopic()}
						>
							{isBusy ? (
								<ActivityIndicator color="#FFFFFF" />
							) : (
								<Text>Weiter</Text>
							)}
						</Button>
					</View>
				</View>
			</ScreenScroll>

			<BottomModal
				visible={isUploadSheetVisible}
				title="Was möchtest du hochladen?"
				description="Lade hier deine Unterlagen hoch oder scanne sie ganz einfach."
				onClose={closeUploadSheet}
				onDismiss={runPendingUploadAction}
				closeAccessibilityLabel="Hochladen schließen"
				contentClassName="flex-row gap-2"
			>
				<BottomModalOption
					layout="tile"
					title="Scannen"
					onPress={() => chooseUploadAction("camera")}
					disabled={!canUploadMaterial}
					icon={
						openingUploadAction === "camera" || isBusy ? (
							<ActivityIndicator color={bottomModalIconColor} />
						) : (
							<ScanImage
								size={28}
								color={bottomModalIconColor}
								strokeWidth={1.8}
							/>
						)
					}
				/>
				<BottomModalOption
					layout="tile"
					title="Dateien"
					onPress={() => chooseUploadAction("files")}
					disabled={!canUploadMaterial}
					icon={
						openingUploadAction === "files" || isBusy ? (
							<ActivityIndicator color={bottomModalIconColor} />
						) : (
							<Attachment
								size={28}
								color={bottomModalIconColor}
								strokeWidth={1.8}
							/>
						)
					}
				/>
			</BottomModal>
		</Screen>
	);
}
