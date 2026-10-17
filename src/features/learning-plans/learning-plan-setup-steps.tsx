import { ActivityIndicator, View } from "react-native";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { GraduationCap, Plus } from "~/components/ui/icon";
import { ActionSurface, Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { MaterialCard } from "~/features/learning-plans/learning-plan-ui";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { useDayovaTheme } from "~/lib/theme";
import { ExamHintsEditor } from "./exam-hints-editor";
import type { HintVariant } from "./hint-validation-preference";
import { type SearchTopics, TopicSearch } from "./topic-search";

type PendingUploadAction = "camera" | "library" | "files";

function SetupContinueButton({
	canContinue,
	isBusy,
	label = "Weiter",
	onPress,
}: {
	canContinue: boolean;
	isBusy: boolean;
	label?: string;
	onPress: () => void;
}) {
	return (
		<Button
			accessibilityLabel={isBusy ? `${label}, wird geladen` : label}
			accessibilityLiveRegion={isBusy ? "polite" : undefined}
			accessibilityState={{ busy: isBusy, disabled: !canContinue }}
			disabled={!canContinue}
			onPress={onPress}
		>
			{isBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text>{label}</Text>}
		</Button>
	);
}

function UploadActivity({
	isUploading,
	openingUploadAction,
}: {
	isUploading: boolean;
	openingUploadAction: PendingUploadAction | null;
}) {
	const { colors } = useDayovaTheme();
	if (!isUploading && !openingUploadAction) return null;

	return (
		<View className="mt-5 flex-row items-center gap-3 rounded-[24px] bg-system-subtle px-4 py-4">
			<ActivityIndicator color={colors.primaryStrong} />
			<Text className="flex-1 font-poppins text-body-4 text-secondary-text">
				{openingUploadAction === "files"
					? "Dateiauswahl wird geöffnet …"
					: openingUploadAction === "library"
						? "Galerie wird geöffnet …"
						: openingUploadAction === "camera"
							? "Kamera wird geöffnet …"
							: "Material wird hochgeladen …"}
			</Text>
		</View>
	);
}

function SetupError({ message }: { message: string | null }) {
	if (!message) return null;

	return (
		<Text
			selectable
			accessibilityRole="alert"
			className="mt-4 w-full font-poppins text-body-4 text-destructive"
		>
			{message}
		</Text>
	);
}

export function MaterialUploadStepLead({
	mode = "screen",
}: {
	mode?: "screen" | "artwork";
}) {
	const fixedTextScale = mode === "artwork";
	return (
		<>
			<Text
				allowFontScaling={!fixedTextScale}
				className="font-poppins font-semibold text-body-1 text-text"
			>
				Schulmaterial hinzufügen
			</Text>
			<Text
				allowFontScaling={!fixedTextScale}
				className="mt-2 font-poppins text-body-3 text-secondary-text"
			>
				Deine Unterlagen bilden die Grundlage für deinen Lernplan.
			</Text>
		</>
	);
}

type MaterialUploadActionCardProps =
	| {
			canUpload: boolean;
			hasSchoolMaterial: boolean;
			mode?: "screen";
			onPress: () => void;
	  }
	| {
			canUpload?: never;
			hasSchoolMaterial: boolean;
			mode: "artwork";
			onPress?: never;
	  };

export function MaterialUploadActionCard(props: MaterialUploadActionCardProps) {
	const { hasSchoolMaterial } = props;
	const mode = props.mode ?? "screen";
	const { colors } = useDayovaTheme();
	const fixedTextScale = mode === "artwork";
	const content = (
		<>
			<View className="h-12 w-12 items-center justify-center rounded-[18px] bg-system-subtle">
				<GraduationCap
					size={24}
					color={colors.primaryStrong}
					strokeWidth={2.1}
				/>
			</View>
			<View className="min-w-0 flex-1 px-4">
				<Text
					allowFontScaling={!fixedTextScale}
					className="font-poppins font-semibold text-body-2 text-text"
				>
					{hasSchoolMaterial
						? "Weiteres Schulmaterial"
						: "Schulmaterial hochladen"}
				</Text>
				<Text
					allowFontScaling={!fixedTextScale}
					className="mt-1 font-poppins text-body-4 text-secondary-text"
				>
					Themenblatt, Arbeitsblätter oder Mitschriften
				</Text>
			</View>
			<Plus size={22} color={colors.primaryStrong} strokeWidth={2.2} />
		</>
	);
	const className =
		"mt-7 min-h-[112px] flex-row items-center rounded-[32px] border border-border px-5 py-5";

	if (props.mode === "artwork") {
		return (
			<Surface
				accessible={false}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				className={className}
				variant="soft"
			>
				{content}
			</Surface>
		);
	}

	return (
		<ActionSurface
			accessibilityHint="Öffnet die Auswahl zum Scannen oder Hochladen von Schulmaterial."
			accessibilityLabel={
				hasSchoolMaterial
					? "Weiteres Schulmaterial hinzufügen"
					: "Schulmaterial hinzufügen"
			}
			accessibilityRole="button"
			disabled={!props.canUpload}
			onPress={() => props.onPress()}
			className={className}
			variant="soft"
		>
			{content}
		</ActionSurface>
	);
}

export function MaterialUploadStep({
	canUpload,
	canContinue,
	documents,
	errorMessage,
	isBusy,
	isUploading,
	onContinue,
	onOpenUpload,
	onRemoveDocument,
	onSkip,
	openingUploadAction,
	showSkip = true,
}: {
	canUpload: boolean;
	canContinue: boolean;
	documents: LearningPlanSnapshot["documents"];
	errorMessage: string | null;
	isBusy: boolean;
	isUploading: boolean;
	onContinue: () => void;
	onOpenUpload: () => void;
	onRemoveDocument: (id: Id<"learningPlanDocuments">) => void;
	onSkip: () => void;
	openingUploadAction: PendingUploadAction | null;
	showSkip?: boolean;
}) {
	const schoolDocuments = documents.filter(
		(document) => document.sourceKind === "school",
	);
	const hasSchoolMaterial = schoolDocuments.length > 0;

	return (
		<View className="flex-1">
			<MaterialUploadStepLead />
			<MaterialUploadActionCard
				canUpload={canUpload}
				hasSchoolMaterial={hasSchoolMaterial}
				onPress={onOpenUpload}
			/>

			{showSkip && !hasSchoolMaterial ? (
				<Text className="mt-3 font-poppins text-body-4 text-secondary-text">
					Dein Lernplan-Entwurf bleibt gespeichert. Schulmaterial kannst du
					später ergänzen.
				</Text>
			) : null}

			<UploadActivity
				isUploading={isUploading}
				openingUploadAction={openingUploadAction}
			/>

			{hasSchoolMaterial ? (
				<View className="mt-7">
					<Text className="mb-3 font-poppins font-semibold text-body-4 text-secondary-text">
						Hochgeladen
					</Text>
					{schoolDocuments.map((document) => (
						<MaterialCard
							key={document.id}
							name={document.fileName}
							size={document.fileSizeBytes}
							onRemove={() => onRemoveDocument(document.id)}
						/>
					))}
				</View>
			) : null}

			<SetupError message={errorMessage} />
			<View className="mt-auto w-full gap-3 pt-8">
				{hasSchoolMaterial ? (
					<SetupContinueButton
						canContinue={canContinue}
						isBusy={isBusy}
						onPress={onContinue}
					/>
				) : showSkip ? (
					<Button
						accessibilityHint="Speichert den Lernplan-Entwurf. Material kann später hochgeladen werden."
						variant="neutral"
						disabled={!canUpload}
						onPress={onSkip}
					>
						<Text>Ohne Lernmaterial erstellen</Text>
					</Button>
				) : null}
			</View>
		</View>
	);
}

export function RequiredTopicsStep({
	subject,
	searchTopics,
	canContinue,
	errorMessage,
	isBusy,
	onChangeAdditionalInfo,
	onContinue,
	additionalInfo,
	selectedTopics,
	onChangeSelectedTopics,
	hintVariant = "inline",
	onOpenHints,
}: {
	canContinue: boolean;
	errorMessage: string | null;
	isBusy: boolean;
	onChangeAdditionalInfo: (value: string) => void;
	onChangeSelectedTopics: (value: string[]) => void;
	onContinue: () => void;
	additionalInfo: string;
	selectedTopics: string[];
	subject: string;
	searchTopics: SearchTopics;
	hintVariant?: HintVariant;
	onOpenHints?: () => void;
}) {
	return (
		<View className="flex-1">
			<Text
				accessibilityRole="header"
				className="font-poppins font-semibold text-body-1 text-text"
			>
				Welche Themen kommen in der Prüfung dran?
			</Text>
			<Text className="mt-3 font-poppins text-body-3 text-secondary-text">
				Wähle Vorschläge aus oder übernimm deinen eigenen Begriff.
			</Text>
			<TopicSearch
				selectedTopics={selectedTopics}
				subject={subject}
				onChangeSelectedTopics={onChangeSelectedTopics}
				searchTopics={searchTopics}
				disabled={isBusy}
			/>
			<View className="mt-6 gap-3">
				{hintVariant === "inline" ? (
					<>
						<Text className="font-poppins text-body-4 text-secondary-text">
							Hinweise zur Prüfung (optional)
						</Text>
						<ExamHintsEditor
							subject={subject}
							selectedTopics={selectedTopics}
							value={additionalInfo}
							onChange={onChangeAdditionalInfo}
							disabled={isBusy}
						/>
					</>
				) : (
					<>
						{additionalInfo.trim() ? (
							<Text
								selectable
								className="font-poppins text-body-3 text-text"
								numberOfLines={3}
							>
								{additionalInfo}
							</Text>
						) : null}
						<Button variant="cancel" disabled={isBusy} onPress={onOpenHints}>
							<Text>
								{additionalInfo.trim()
									? "Hinweise ansehen oder bearbeiten"
									: "Prüfungsbedingungen oder Hinweise ergänzen (optional)"}
							</Text>
						</Button>
					</>
				)}
			</View>

			<SetupError message={errorMessage} />
			<View className="mt-auto pt-8">
				<SetupContinueButton
					canContinue={canContinue}
					isBusy={isBusy}
					onPress={onContinue}
				/>
			</View>
		</View>
	);
}

export function ExamHintsStep({
	subject,
	selectedTopics,
	additionalInfo,
	onChange,
	onDone,
	isBusy,
}: {
	subject: string;
	selectedTopics: string[];
	additionalInfo: string;
	onChange: (value: string) => void;
	onDone: () => void;
	isBusy: boolean;
}) {
	return (
		<View className="flex-1 gap-4">
			<Text
				accessibilityRole="header"
				className="font-poppins font-semibold text-body-1 text-text"
			>
				Hinweise zur Prüfung (optional)
			</Text>
			<ExamHintsEditor
				subject={subject}
				selectedTopics={selectedTopics}
				value={additionalInfo}
				onChange={onChange}
				disabled={isBusy}
			/>
			<View className="mt-auto pt-8">
				<Button disabled={isBusy} onPress={onDone}>
					<Text>Zurück zu den Themen</Text>
				</Button>
			</View>
		</View>
	);
}
