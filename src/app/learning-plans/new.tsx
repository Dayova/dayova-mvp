import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { fetch } from "expo/fetch";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	Pressable,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader as Header } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { CloseButton } from "~/components/ui/close-button";
import { FieldControl, FieldLabel } from "~/components/ui/field";
import { Attachment, Plus, ScanImage } from "~/components/ui/icon";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
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
import { logDiagnosticError } from "~/lib/diagnostics";
import { goBackOrReplace } from "~/lib/navigation";
import { ROUTES } from "~/lib/routes";
import { ACCEPTED_FILE_TYPES, validateUploadFile } from "~/lib/upload-policy";

const TOPIC_TEXTAREA_HEIGHT = 160;
const TOPIC_TEXTAREA_CARD_HEIGHT = 202;
const UPLOAD_TIMEOUT_MS = 45_000;
const UPLOAD_COMPLETION_FAILURE_MESSAGE =
	"Die Datei wurde übertragen, aber Dayova konnte den Upload nicht abschließen. Bitte versuche es erneut.";

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

type PreparedUploadAsset = {
	asset: UploadAsset;
	file: File;
	fileSizeBytes: number;
	fileType: string;
};

type PendingUploadAction = "camera" | "files";

function UploadSheetOption({
	icon,
	title,
	description,
	disabled,
	onPress,
	scale,
	width,
}: {
	icon: React.ReactNode;
	title: string;
	description: string;
	disabled: boolean;
	onPress: () => void;
	scale: number;
	width: number;
}) {
	return (
		<TouchableOpacity
			accessibilityLabel={title}
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			activeOpacity={0.86}
			disabled={disabled}
			onPress={onPress}
			className="flex-row items-center bg-card"
			style={{
				width,
				height: 96 * scale,
				borderRadius: 40 * scale,
				paddingHorizontal: 16 * scale,
				paddingVertical: 12 * scale,
				columnGap: 16 * scale,
				opacity: disabled ? 0.55 : 1,
				boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
			}}
		>
			<View
				className="items-center justify-center rounded-full bg-accent"
				style={{
					width: 48 * scale,
					height: 48 * scale,
					boxShadow:
						"0 2px 4px -2px rgba(24, 39, 75, 0.12), 0 4px 4px -2px rgba(24, 39, 75, 0.08)",
				}}
			>
				{icon}
			</View>
			<View style={{ flex: 1, rowGap: 4 * scale }}>
				<Text
					className="font-poppins font-semibold text-black"
					// Upload option typography scales with the measured sheet width.
					style={{
						fontSize: 16 * scale,
						lineHeight: 24 * scale,
					}}
				>
					{title}
				</Text>
				<Text
					className="font-poppins text-secondary-text"
					// Upload option typography scales with the measured sheet width.
					style={{
						fontSize: 12 * scale,
						lineHeight: 18 * scale,
					}}
				>
					{description}
				</Text>
			</View>
		</TouchableOpacity>
	);
}

export default function NewLearningPlanScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const params = useLocalSearchParams<{
		learningPlanId?: string;
		examDayEntryId?: string;
		subject?: string;
		examTypeLabel?: string;
		examDateKey?: string;
		examDateLabel?: string;
		examTime?: string;
		durationMinutes?: string;
		topicDescription?: string;
		errorMessage?: string;
	}>();
	const { user } = useAuth();
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
	const examTime = params.examTime || "17:00";
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

	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && learningPlanId
			? { id: learningPlanId }
			: "skip",
	) ?? null) as LearningPlanSnapshot | null;

	const canWrite = Boolean(user && isConvexAuthenticated);
	const hasExamEntry = Boolean(examDayEntryId || learningPlanId);
	const topicDescription =
		topicDescriptionInput ?? snapshot?.plan.topicDescription ?? "";
	const canContinueTopic = topicDescription.trim().length >= 8 && canWrite;
	const canUploadMaterial = canWrite && !isBusy && !openingUploadAction;
	const modalScale = clamp(width / 393, 0.88, 1.06);
	const uploadOptionWidth = Math.min(width - 48 * modalScale, 345 * modalScale);
	const uploadSheetBottomPadding = Math.max(
		insets.bottom + 28 * modalScale,
		42,
	);

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
				examTime,
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
							uploadMethod: uploadData.storageProvider === "r2" ? "PUT" : "POST",
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

	const goBack = () => {
		goBackOrReplace(router, ROUTES.createExam);
	};

	if (!hasExamEntry) return null;

	return (
		<Screen>
			<Stack.Screen options={{ gestureEnabled: true }} />
			<StatusBar style="dark" />
			<ScreenScroll>
				<Header title="Prüfungsthema" onBack={goBack} />
				<SectionTitle
					title="Lernplan erstellen"
					description="Beschreibe den Prüfungsinhalt und lade optional Schulmaterial hoch."
				/>
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

			<Modal
				visible={isUploadSheetVisible}
				transparent
				animationType="fade"
				onDismiss={runPendingUploadAction}
				onRequestClose={closeUploadSheet}
			>
				<View className="flex-1 justify-end">
					<Pressable
						className="absolute inset-0 bg-black/25"
						onPress={closeUploadSheet}
					/>
					<View
						className="bg-background"
						style={{
							width,
							borderTopLeftRadius: 40 * modalScale,
							borderTopRightRadius: 40 * modalScale,
							paddingTop: 24 * modalScale,
							paddingHorizontal: 24 * modalScale,
							paddingBottom: uploadSheetBottomPadding,
							boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
						}}
					>
						<View
							className="flex-row items-start justify-between"
							style={{ minHeight: 46 * modalScale, columnGap: 16 * modalScale }}
						>
							<View className="flex-1">
								<Text
									className="font-poppins font-semibold text-black"
									// Modal header typography scales with the measured sheet width.
									style={{
										fontSize: 16 * modalScale,
										lineHeight: 24 * modalScale,
									}}
								>
									Hochladen
								</Text>
								<Text
									className="font-poppins text-secondary-text"
									// Modal description typography scales with the measured sheet width.
									style={{
										fontSize: 12 * modalScale,
										lineHeight: 18 * modalScale,
									}}
								>
									Wähle aus, wie du deine Unterlagen hinzufügen möchtest.
								</Text>
							</View>
							<CloseButton
								accessibilityLabel="Hochladen schließen"
								onPress={closeUploadSheet}
							/>
						</View>
						<View
							className="items-center"
							style={{ marginTop: 12 * modalScale, rowGap: 24 * modalScale }}
						>
							<UploadSheetOption
								title="Scannen"
								description="Unterlagen mit der Kamera erfassen."
								onPress={() => chooseUploadAction("camera")}
								disabled={!canUploadMaterial}
								scale={modalScale}
								width={uploadOptionWidth}
								icon={
									openingUploadAction === "camera" || isBusy ? (
										<ActivityIndicator color="#00BAFF" />
									) : (
										<ScanImage
											size={24 * modalScale}
											color="#00BAFF"
											strokeWidth={1.8}
										/>
									)
								}
							/>
							<UploadSheetOption
								title="Dateien"
								description="PDF, Bilder oder Dokumente auswählen."
								onPress={() => chooseUploadAction("files")}
								disabled={!canUploadMaterial}
								scale={modalScale}
								width={uploadOptionWidth}
								icon={
									openingUploadAction === "files" || isBusy ? (
										<ActivityIndicator color="#00BAFF" />
									) : (
										<Attachment
											size={24 * modalScale}
											color="#00BAFF"
											strokeWidth={1.8}
										/>
									)
								}
							/>
						</View>
					</View>
				</View>
			</Modal>
		</Screen>
	);
}
