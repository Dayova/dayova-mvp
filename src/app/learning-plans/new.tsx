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
import { ScreenHeader as Header } from "~/components/screen-header";
import {
	BottomModal,
	BottomModalOption,
	bottomModalIconColor,
} from "~/components/ui/bottom-modal";
import { Button } from "~/components/ui/button";
import { FieldControl, FieldLabel } from "~/components/ui/field";
import { Attachment, Plus, ScanImage } from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { WarningBanner } from "~/components/ui/warning-banner";
import { useAuth } from "~/context/AuthContext";
import {
	MaterialCard,
	SectionTitle,
} from "~/features/learning-plans/learning-plan-ui";
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
import { ROUTES, withReturnTo } from "~/lib/routes";
import { ACCEPTED_FILE_TYPES, validateUploadFile } from "~/lib/upload-policy";

const TOPIC_TEXTAREA_HEIGHT = 160;
const TOPIC_TEXTAREA_CARD_HEIGHT = 202;
const UPLOAD_TIMEOUT_MS = 45_000;
const UPLOAD_COMPLETION_FAILURE_MESSAGE =
	"Die Datei wurde übertragen, aber Dayova konnte den Upload nicht abschließen. Bitte versuche es erneut.";

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

type PreparedUploadAsset = {
	asset: UploadAsset;
	file: File;
	fileSizeBytes: number;
	fileType: string;
};

type PendingUploadAction = "camera" | "files";

export default function NewLearningPlanScreen() {
	const router = useRouter();
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
	const startPlan = useMutation(api.learningPlans.start);
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
		user && isConvexAuthenticated && hasExamEntry ? {} : "skip",
	);

	const canWrite = Boolean(user && isConvexAuthenticated);
	const topicDescription =
		topicDescriptionInput ?? snapshot?.plan.topicDescription ?? "";
	const canContinueTopic = topicDescription.trim().length >= 8 && canWrite;
	const canUploadMaterial = canWrite && !isBusy && !openingUploadAction;
	const showLearningTimesWarning =
		learningTimes !== undefined && learningTimes.length === 0;

	useEffect(() => {
		if (!hasExamEntry) {
			router.replace(ROUTES.createExam);
		}
	}, [hasExamEntry, router]);

	const ensurePlan = async ({
		requireMeaningfulTopic = true,
	}: {
		requireMeaningfulTopic?: boolean;
	} = {}) => {
		if (learningPlanId) {
			if (requireMeaningfulTopic) {
				await retryOnceAfterAuthResume(() =>
					updateBasics({
						id: learningPlanId,
						topicDescription,
						notes: "",
					}),
				);
			}
			return learningPlanId;
		}

		if (!examDayEntryId) {
			throw new Error("Erstelle zuerst eine Prüfung.");
		}

		const createPlan = requireMeaningfulTopic ? startPlan : createDraftPlan;
		const id = await retryOnceAfterAuthResume(() =>
			createPlan({
				examDayEntryId,
				subject,
				examTypeLabel,
				examDateKey,
				examDateLabel,
				durationMinutes,
				topicDescription,
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
		const id =
			existingLearningPlanId ??
			(await ensurePlan({ requireMeaningfulTopic: false }));
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
					const id = await ensurePlan({ requireMeaningfulTopic: false });

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

	const continueToAnalysis = async () => {
		if (!canContinueTopic || isBusy) return;

		await runWithErrorHandling(
			"Die Wissensanalyse konnte nicht vorbereitet werden.",
			async () => {
				const id = await ensurePlan();
				router.push(planPath(id, "analysis"));
			},
		);
	};

	const getLearningPlanReturnPath = () => {
		const queryParams: Array<[string, string | number | null | undefined]> = [
			["learningPlanId", learningPlanId],
			["examDayEntryId", examDayEntryId],
			["subject", subject],
			["examTypeLabel", examTypeLabel],
			["examDateKey", examDateKey],
			["examDateLabel", examDateLabel],
			["durationMinutes", durationMinutes],
			["topicDescription", topicDescription],
		];
		const query = queryParams
			.filter(([, value]) => value !== undefined && value !== null)
			.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
			.join("&");

		return `${ROUTES.createLearningPlan}?${query}`;
	};

	const openLearningTimes = () => {
		router.push(
			withReturnTo(ROUTES.learningTimes, getLearningPlanReturnPath()),
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
			<ScreenScroll>
				<Header title="Prüfungsthema" onBack={goBack} />
				<SectionTitle
					title="Lernplan erstellen"
					description="Beschreibe den Prüfungsinhalt und lade optional Schulmaterial hoch."
				/>
				{showLearningTimesWarning ? (
					<WarningBanner
						className="mb-7"
						title="Lernzeiten fehlen"
						description="Ohne Lernzeiten weiß Dayova nicht, wann der Lernplan eingetragen werden soll. Lege mindestens eine Lernzeit an, damit wir deinen Plan erstellen können."
						ctaLabel="Lernzeiten eintragen"
						onPressCta={openLearningTimes}
					/>
				) : null}
				<FieldLabel>Thema beschreiben</FieldLabel>
				<FieldControl
					className="mb-7 min-h-[150px] items-start rounded-[28px] px-5 pt-4 pb-4"
					style={{
						height: TOPIC_TEXTAREA_CARD_HEIGHT,
						boxShadow: "0 6px 13px rgba(0, 0, 0, 0.08)",
					}}
				>
					<Textarea
						value={topicDescription}
						onChangeText={setTopicDescriptionInput}
						placeholder="Kurze Beschreibung hinzufügen"
						style={{ height: TOPIC_TEXTAREA_HEIGHT }}
					/>
				</FieldControl>

				<FieldLabel>Materialien</FieldLabel>
				<ActionSurface
					accessibilityLabel="Material hochladen"
					accessibilityRole="button"
					accessibilityState={{ disabled: !canUploadMaterial }}
					activeOpacity={0.86}
					disabled={!canUploadMaterial}
					onPress={() => setIsUploadSheetVisible(true)}
					className="mb-5 items-center justify-center py-10"
				>
					<View
						className="items-center justify-center"
						style={{
							width: 48,
							height: 48,
							borderRadius: 24,
							backgroundColor: "#00BAFF",
							shadowColor: "#00BAFF",
							shadowOpacity: 0.24,
							shadowRadius: 12,
							shadowOffset: { width: 0, height: 4 },
							elevation: 3,
						}}
					>
						{isBusy || openingUploadAction ? (
							<ActivityIndicator color="#FFFFFF" />
						) : (
							<Plus size={26} color="#FFFFFF" strokeWidth={2.1} />
						)}
					</View>
					<Text className="mt-3 text-center font-poppins text-body-4 text-secondary-text">
						{openingUploadAction === "files"
							? "Dateiauswahl wird geöffnet …"
							: openingUploadAction === "camera"
								? "Kamera wird geöffnet …"
								: isBusy
									? "Material wird hochgeladen …"
									: "Lade deine Mitschriften hoch"}
					</Text>
				</ActionSurface>

				{snapshot?.documents.map((document) => (
					<MaterialCard
						key={document.id}
						name={document.fileName}
						size={document.fileSizeBytes}
						onRemove={() => removeDocument({ id: document.id })}
					/>
				))}

				{errorMessage ? (
					<Text className="mb-4 font-poppins text-body-4 text-destructive">
						{errorMessage}
					</Text>
				) : null}
				<Button
					accessibilityLabel={isBusy ? "Weiter, wird geladen" : "Weiter"}
					accessibilityLiveRegion={isBusy ? "polite" : undefined}
					accessibilityState={{
						busy: isBusy,
						disabled: !canContinueTopic || isBusy,
					}}
					disabled={!canContinueTopic || isBusy}
					onPress={continueToAnalysis}
					style={{
						shadowColor: "#00BAFF",
						shadowOpacity: 0.3,
						shadowRadius: 14,
						shadowOffset: { width: 0, height: 7 },
						elevation: 5,
					}}
				>
					{isBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text>Weiter</Text>}
				</Button>
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
