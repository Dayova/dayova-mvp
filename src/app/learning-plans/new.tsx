import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
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
import { ScreenHeader as Header } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { Attachment, Plus, ScanImage, X } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/context/AuthContext";
import {
	MaterialCard,
	SectionTitle,
	UploadAction,
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
import { goBackOrReplace } from "~/lib/navigation";
import { ACCEPTED_FILE_TYPES, validateUploadFile } from "~/lib/upload-policy";

const TOPIC_TEXTAREA_HEIGHT = 160;
const TOPIC_TEXTAREA_CARD_HEIGHT = 202;

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

export default function NewLearningPlanScreen() {
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

	const subject = params.subject?.trim() || "Fach";
	const examTypeLabel = params.examTypeLabel?.trim() || "Leistungskontrolle";
	const examDateKey = params.examDateKey || getDateKey(new Date());
	const examDateLabel =
		params.examDateLabel || formatDate(parseDateKey(examDateKey));
	const examTime = params.examTime || "17:00";
	const durationMinutes = Number(params.durationMinutes ?? 45) || 45;

	const [learningPlanId, setLearningPlanId] =
		useState<Id<"learningPlans"> | null>(null);
	const [topicDescription, setTopicDescription] = useState("");
	const [isBusy, setIsBusy] = useState(false);
	const [isUploadSheetVisible, setIsUploadSheetVisible] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const snapshot = (useQuery(
		api.learningPlans.getSnapshot,
		user && isConvexAuthenticated && learningPlanId
			? { id: learningPlanId }
			: "skip",
	) ?? null) as LearningPlanSnapshot | null;

	const canWrite = Boolean(user && isConvexAuthenticated);
	const canContinueTopic = topicDescription.trim().length >= 8 && canWrite;
	const canUploadMaterial = canWrite && !isBusy;

	const ensurePlan = async () => {
		if (learningPlanId) {
			await retryOnceAfterAuthResume(() =>
				updateBasics({
					id: learningPlanId,
					topicDescription,
					notes: "",
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

	const uploadLearningPlanAsset = async (
		asset: UploadAsset,
		existingLearningPlanId?: Id<"learningPlans">,
	) => {
		const id = existingLearningPlanId ?? (await ensurePlan());
		const fileResponse = await fetch(asset.uri);
		const blob = await fileResponse.blob();
		const fileSizeBytes = blob.size;
		const fileType = asset.mimeType || blob.type || "application/octet-stream";

		const validation = validateUploadFile({
			name: asset.name,
			size: fileSizeBytes,
		});
		if (!validation.valid) throw new Error(validation.message);

		const uploadData = await retryOnceAfterAuthResume(() =>
			generateUploadUrl({ learningPlanId: id }),
		);
		const uploadResponse = await fetch(uploadData.uploadUrl, {
			method: uploadData.storageProvider === "r2" ? "PUT" : "POST",
			headers: { "Content-Type": fileType },
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
		if (!storageId)
			throw new Error("Upload konnte nicht abgeschlossen werden.");

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
					multiple: true,
					copyToCacheDirectory: true,
				});
				if (result.canceled) return;

				await Promise.all(
					result.assets.map((asset) =>
						uploadLearningPlanAsset(
							{
								uri: asset.uri,
								name: asset.name,
								mimeType: asset.mimeType,
								size: asset.size,
							},
							id,
						),
					),
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
				router.replace(planPath(id, "analysis"));
			},
		);
	};

	const goBack = () => {
		goBackOrReplace(router, "/home");
	};

	return (
		<KeyboardAvoidingView
			className="flex-1 bg-[#F5F3F6]"
			behavior={Platform.OS === "ios" ? "padding" : "height"}
		>
			<Stack.Screen options={{ gestureEnabled: true }} />
			<StatusBar style="dark" />
			<ScrollView
				className="flex-1"
				contentContainerStyle={{
					paddingHorizontal: 32,
					paddingTop: 80,
					paddingBottom: 60,
				}}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<Header title="Prüfungsthema" onBack={goBack} />
				<SectionTitle
					title="Lernplan erstellen"
					description="Beschreibe den Prüfungsinhalt und lade optional Schulmaterial hoch."
				/>
				<Text className="mb-3 font-medium font-poppins text-14 text-text">
					Thema beschreiben
				</Text>
				<View
					className="mb-7 items-start rounded-[36px] bg-white px-[24px] pt-[19px] pb-5"
					style={{
						height: TOPIC_TEXTAREA_CARD_HEIGHT,
						shadowColor: "#000000",
						shadowOpacity: 0.08,
						shadowRadius: 13,
						shadowOffset: { width: 0, height: 6 },
						elevation: 3,
					}}
				>
					<Textarea
						value={topicDescription}
						onChangeText={setTopicDescription}
						placeholder="Kurze Beschreibung hinzufügen"
						style={{ height: TOPIC_TEXTAREA_HEIGHT }}
					/>
				</View>

				<Text className="mb-3 font-medium font-poppins text-14 text-text">
					Notizen
				</Text>
				<TouchableOpacity
					accessibilityLabel="Material hochladen"
					accessibilityRole="button"
					accessibilityState={{ disabled: !canUploadMaterial }}
					activeOpacity={0.86}
					disabled={!canUploadMaterial}
					onPress={() => setIsUploadSheetVisible(true)}
					className="mb-5 min-h-[152px] items-center justify-center rounded-[36px] bg-white px-5 py-6"
					style={{
						shadowColor: "#000000",
						shadowOpacity: 0.08,
						shadowRadius: 13,
						shadowOffset: { width: 0, height: 6 },
						elevation: 3,
						opacity: canUploadMaterial ? 1 : 0.55,
					}}
				>
					<View
						className="h-14 w-14 items-center justify-center rounded-full bg-primary"
						style={{
							shadowColor: "#3A7BFF",
							shadowOpacity: 0.35,
							shadowRadius: 18,
							shadowOffset: { width: 0, height: 7 },
							elevation: 5,
						}}
					>
						{isBusy ? (
							<ActivityIndicator color="#FFFFFF" />
						) : (
							<Plus size={30} color="#FFFFFF" strokeWidth={2.1} />
						)}
					</View>
					<Text className="pt-[7px] text-center font-poppins text-14 text-text/45">
						Lade deine Mitschriften hoch
					</Text>
				</TouchableOpacity>

				{snapshot?.documents.map((document) => (
					<MaterialCard
						key={document.id}
						name={document.fileName}
						size={document.fileSizeBytes}
						onRemove={() => removeDocument({ id: document.id })}
					/>
				))}

				{errorMessage ? (
					<Text className="mb-4 font-poppins text-12 text-destructive">
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
					className="mt-12"
					disabled={!canContinueTopic || isBusy}
					onPress={continueToAnalysis}
					style={{
						shadowColor: "#3A7BFF",
						shadowOpacity: 0.3,
						shadowRadius: 14,
						shadowOffset: { width: 0, height: 7 },
						elevation: 5,
					}}
				>
					{isBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text>Weiter</Text>}
				</Button>
			</ScrollView>

			<Modal
				visible={isUploadSheetVisible}
				transparent
				animationType="fade"
				onRequestClose={() => setIsUploadSheetVisible(false)}
			>
				<View className="flex-1 justify-end">
					<Pressable
						className="absolute inset-0 bg-black/30"
						onPress={() => setIsUploadSheetVisible(false)}
					/>
					<View
						className="mx-9 mb-20 min-h-[325px] rounded-t-[30px] rounded-b-[32px] bg-[#FBFAFC] px-5 pt-20 pb-14"
						style={{
							shadowColor: "#3A7BFF",
							shadowOpacity: 0.5,
							shadowRadius: 18,
							shadowOffset: { width: 0, height: 10 },
							elevation: 10,
						}}
					>
						<TouchableOpacity
							accessibilityLabel="Hochladen schließen"
							accessibilityRole="button"
							hitSlop={8}
							activeOpacity={0.78}
							onPress={() => setIsUploadSheetVisible(false)}
							className="absolute top-5 right-5 h-9 w-9 items-center justify-center rounded-full bg-[#ECECEF]"
							style={{
								shadowColor: "#000000",
								shadowOpacity: 0.12,
								shadowRadius: 8,
								shadowOffset: { width: 0, height: 4 },
								elevation: 3,
							}}
						>
							<X size={18} color="#1A1A1A" strokeWidth={2.4} />
						</TouchableOpacity>
						<Text className="text-center font-poppins font-semibold text-xl">
							Hochladen
						</Text>
						<Text className="mt-2 text-center font-poppins text-12 text-text/45 leading-4">
							Lade hier deine Unterlagen hoch oder{"\n"}scanne sie.
						</Text>
						<View className="mt-6 flex-row" style={{ columnGap: 14 }}>
							<UploadAction
								label="Scannen"
								onPress={() => {
									setIsUploadSheetVisible(false);
									void takePhoto();
								}}
								disabled={!canUploadMaterial}
								icon={
									isBusy ? (
										<ActivityIndicator color="#3A7BFF" />
									) : (
										<ScanImage size={30} color="#3A7BFF" strokeWidth={2} />
									)
								}
							/>
							<UploadAction
								label="Dateien"
								onPress={() => {
									setIsUploadSheetVisible(false);
									void uploadMaterial();
								}}
								disabled={!canUploadMaterial}
								icon={
									isBusy ? (
										<ActivityIndicator color="#3A7BFF" />
									) : (
										<Attachment size={30} color="#3A7BFF" strokeWidth={2} />
									)
								}
							/>
						</View>
					</View>
				</View>
			</Modal>
		</KeyboardAvoidingView>
	);
}
