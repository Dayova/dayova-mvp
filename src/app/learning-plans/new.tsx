import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import * as DocumentPicker from "expo-document-picker";
import { File, UploadType } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { ROUTES } from "~/lib/routes";
import { ACCEPTED_FILE_TYPES, validateUploadFile } from "~/lib/upload-policy";

const TOPIC_TEXTAREA_HEIGHT = 160;
const TOPIC_TEXTAREA_CARD_HEIGHT = 202;

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

const planPath = (id: Id<"learningPlans">, step: string) =>
	`/learning-plans/${id}/${step}` as const;

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
			className="flex-row items-center bg-white"
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
				className="items-center justify-center rounded-full bg-[#EAF3FF]"
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
					className="font-medium font-poppins text-black"
					style={{
						fontSize: 16 * scale,
						lineHeight: 24 * scale,
						includeFontPadding: false,
					}}
				>
					{title}
				</Text>
				<Text
					className="font-poppins text-[#7E7E7E]"
					style={{
						fontSize: 12 * scale,
						lineHeight: 18 * scale,
						includeFontPadding: false,
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
		examDayEntryId?: string;
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
	const examDayEntryId = params.examDayEntryId as Id<"dayEntries"> | undefined;

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
	const hasExamEntry = Boolean(examDayEntryId);
	const canContinueTopic = topicDescription.trim().length >= 8 && canWrite;
	const canUploadMaterial = canWrite && !isBusy;
	const modalScale = clamp(width / 393, 0.88, 1.06);
	const uploadOptionWidth = Math.min(width - 48 * modalScale, 345 * modalScale);
	const uploadSheetBottomPadding = Math.max(insets.bottom + 28 * modalScale, 42);

	useEffect(() => {
		if (!hasExamEntry) {
			router.replace(ROUTES.createExam);
		}
	}, [hasExamEntry, router]);

	const ensurePlan = async () => {
		if (!examDayEntryId) {
			throw new Error("Erstelle zuerst eine Prüfung.");
		}

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

	const uploadLearningPlanAsset = async (
		asset: UploadAsset,
		existingLearningPlanId?: Id<"learningPlans">,
	) => {
		const id = existingLearningPlanId ?? (await ensurePlan());
		const file = new File(asset.uri);
		const fileSizeBytes = asset.size ?? file.info().size ?? 0;
		const fileType = asset.mimeType || "application/octet-stream";

		const validation = validateUploadFile({
			name: asset.name,
			size: fileSizeBytes,
		});
		if (!validation.valid) throw new Error(validation.message);

		const uploadData = await retryOnceAfterAuthResume(() =>
			generateUploadUrl({ learningPlanId: id }),
		);
		const uploadResult = await file.upload(uploadData.uploadUrl, {
			httpMethod: uploadData.storageProvider === "r2" ? "PUT" : "POST",
			uploadType: UploadType.BINARY_CONTENT,
			mimeType: fileType,
			headers: { "Content-Type": fileType },
		});
		const uploadResponse = new Response(uploadResult.body, {
			status: uploadResult.status,
			headers: uploadResult.headers,
		});
		if (!uploadResponse.ok) {
			throw new Error(
				getUploadFailureMessage(
					uploadData.storageProvider,
					uploadResponse,
					uploadResult.body,
				),
			);
		}

		let storageId = uploadData.storageId;
		if (!storageId) {
			const parsedUploadResult = JSON.parse(uploadResult.body) as {
				storageId?: string;
			};
			storageId = parsedUploadResult.storageId ?? null;
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
		goBackOrReplace(router, ROUTES.createExam);
	};

	if (!hasExamEntry) return null;

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
					className="mb-5 flex-row items-center rounded-[40px] bg-white"
					style={{
						height: 96,
						paddingHorizontal: 16,
						paddingVertical: 12,
						columnGap: 16,
						shadowColor: "#000000",
						shadowOpacity: 0.08,
						shadowRadius: 13,
						shadowOffset: { width: 0, height: 6 },
						elevation: 3,
						opacity: canUploadMaterial ? 1 : 0.55,
					}}
				>
					<View
						className="h-12 w-12 items-center justify-center rounded-full bg-[#EAF3FF]"
						style={{
							shadowColor: "#3A7BFF",
							shadowOpacity: 0.12,
							shadowRadius: 12,
							shadowOffset: { width: 0, height: 4 },
							elevation: 3,
						}}
					>
						{isBusy ? (
							<ActivityIndicator color="#3A7BFF" />
						) : (
							<Plus size={26} color="#3A7BFF" strokeWidth={2.1} />
						)}
					</View>
					<View className="flex-1">
						<Text className="font-medium font-poppins text-16 text-black">
							Mitschriften hochladen
						</Text>
						<Text className="mt-1 font-poppins text-12 text-[#7E7E7E]">
							Scannen oder Datei auswählen.
						</Text>
					</View>
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
						className="absolute inset-0 bg-black/25"
						onPress={() => setIsUploadSheetVisible(false)}
					/>
					<View
						className="bg-[#F4F8FB]"
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
							className="flex-row items-start justify-between gap-5"
							style={{ minHeight: 46 * modalScale }}
						>
							<View style={{ width: 311 * modalScale }}>
								<Text
									className="font-medium font-poppins text-black"
									style={{
										fontSize: 16 * modalScale,
										lineHeight: 24 * modalScale,
										includeFontPadding: false,
									}}
								>
									Hochladen
								</Text>
								<Text
									className="font-poppins text-[#7E7E7E]"
									style={{
										fontSize: 12 * modalScale,
										lineHeight: 18 * modalScale,
										includeFontPadding: false,
									}}
								>
									Wähle zuerst die Art aus.
								</Text>
							</View>
							<TouchableOpacity
								accessibilityLabel="Hochladen schließen"
								accessibilityRole="button"
								hitSlop={8}
								activeOpacity={0.75}
								onPress={() => setIsUploadSheetVisible(false)}
								className="items-center justify-center rounded-full bg-[#D9D9D9]"
								style={{
									width: 40 * modalScale,
									height: 40 * modalScale,
									marginRight: 10 * modalScale,
									boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
								}}
							>
								<X size={24 * modalScale} color="#1A1A1A" strokeWidth={2} />
							</TouchableOpacity>
						</View>
						<View
							className="items-center"
							style={{ marginTop: 12 * modalScale, rowGap: 24 * modalScale }}
						>
							<UploadSheetOption
								title="Scannen"
								description="Unterlagen mit der Kamera erfassen."
								onPress={() => {
									setIsUploadSheetVisible(false);
									void takePhoto();
								}}
								disabled={!canUploadMaterial}
								scale={modalScale}
								width={uploadOptionWidth}
								icon={
									isBusy ? (
										<ActivityIndicator color="#3A7BFF" />
									) : (
										<ScanImage
											size={24 * modalScale}
											color="#3A7BFF"
											strokeWidth={1.8}
										/>
									)
								}
							/>
							<UploadSheetOption
								title="Dateien"
								description="PDF, Bilder oder Dokumente auswählen."
								onPress={() => {
									setIsUploadSheetVisible(false);
									void uploadMaterial();
								}}
								disabled={!canUploadMaterial}
								scale={modalScale}
								width={uploadOptionWidth}
								icon={
									isBusy ? (
										<ActivityIndicator color="#3A7BFF" />
									) : (
										<Attachment
											size={24 * modalScale}
											color="#3A7BFF"
											strokeWidth={1.8}
										/>
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
