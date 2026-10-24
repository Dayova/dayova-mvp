import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import {
	type LoadMaterialPreview,
	MaterialUploadGrid,
} from "~/features/learning-plans/material-upload-grid";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { useDayovaTheme } from "~/lib/theme";
import { CreationActionFooter } from "./creation-action-footer";
import { ExamHintsEditor } from "./exam-hints-editor";
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
				accessibilityRole="header"
				className="font-poppins font-semibold text-body-1 text-text"
			>
				Schulmaterial hinzufügen
			</Text>
			<Text
				allowFontScaling={!fixedTextScale}
				className="mt-2 font-poppins text-body-3 text-secondary-text"
			>
				Lade PDFs, Fotos oder andere Dokumente hoch.
			</Text>
		</>
	);
}

export function MaterialUploadStep({
	canUpload,
	canContinue,
	documents,
	errorMessage,
	isBusy,
	isUploading,
	loadPreview,
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
	loadPreview?: LoadMaterialPreview;
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
			<MaterialUploadGrid
				canUpload={canUpload}
				documents={schoolDocuments}
				onOpenUpload={onOpenUpload}
				onRemoveDocument={onRemoveDocument}
				loadPreview={loadPreview}
			/>

			<UploadActivity
				isUploading={isUploading}
				openingUploadAction={openingUploadAction}
			/>

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

function SearchSetupPage({
	children,
	title,
	selectionLabel,
	selectionCount,
	optional = false,
	canContinue,
	errorMessage,
	isBusy,
	onContinue,
}: {
	children: ReactNode;
	title: string;
	selectionLabel: string;
	selectionCount: number;
	optional?: boolean;
	canContinue: boolean;
	errorMessage: string | null;
	isBusy: boolean;
	onContinue: () => void;
}) {
	return (
		<View className="flex-1">
			<ScreenScroll
				includeTopSafeArea={false}
				topPadding={0}
				contentContainerStyle={{ paddingBottom: 24 }}
			>
				<View className="flex-row flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
					<Text
						accessibilityRole="header"
						className="shrink font-poppins font-semibold text-body-1 text-text"
					>
						{title}
					</Text>
					<Text
						accessibilityLabel={`${selectionLabel}: ${selectionCount}${optional ? ", optional" : ""}`}
						className="font-poppins text-body-4 text-secondary-text"
					>
						{optional ? "Optional · " : ""}
						{selectionCount} ausgewählt
					</Text>
				</View>
				{children}
				<SetupError message={errorMessage} />
			</ScreenScroll>
			<CreationActionFooter>
				<SetupContinueButton
					canContinue={canContinue}
					isBusy={isBusy}
					onPress={onContinue}
				/>
			</CreationActionFooter>
		</View>
	);
}

export function RequiredTopicsStep({
	subject,
	searchTopics,
	canContinue,
	errorMessage,
	isBusy,
	onContinue,
	selectedTopics,
	onChangeSelectedTopics,
}: {
	canContinue: boolean;
	errorMessage: string | null;
	isBusy: boolean;
	onChangeSelectedTopics: (value: string[]) => void;
	onContinue: () => void;
	selectedTopics: string[];
	subject: string;
	searchTopics: SearchTopics;
}) {
	return (
		<SearchSetupPage
			title="Prüfungsthemen"
			selectionLabel="Ausgewählte Themen"
			selectionCount={selectedTopics.length}
			canContinue={canContinue}
			errorMessage={errorMessage}
			isBusy={isBusy}
			onContinue={onContinue}
		>
			<TopicSearch
				selectedTopics={selectedTopics}
				subject={subject}
				onChangeSelectedTopics={onChangeSelectedTopics}
				searchTopics={searchTopics}
				disabled={isBusy}
			/>
		</SearchSetupPage>
	);
}

export function ExamHintsStep({
	subject,
	selectedTopics,
	additionalInfo,
	onChange,
	onContinue,
	isBusy,
	canContinue,
	errorMessage,
}: {
	subject: string;
	selectedTopics: string[];
	additionalInfo: string;
	onChange: (value: string) => void;
	onContinue: () => void;
	isBusy: boolean;
	canContinue: boolean;
	errorMessage: string | null;
}) {
	return (
		<SearchSetupPage
			title="Prüfungshinweise"
			selectionLabel="Ausgewählte Hinweise"
			selectionCount={
				additionalInfo.split("\n").filter((line) => line.trim()).length
			}
			optional
			canContinue={canContinue}
			errorMessage={errorMessage}
			isBusy={isBusy}
			onContinue={onContinue}
		>
			<ExamHintsEditor
				subject={subject}
				selectedTopics={selectedTopics}
				value={additionalInfo}
				onChange={onChange}
				disabled={isBusy}
			/>
		</SearchSetupPage>
	);
}
