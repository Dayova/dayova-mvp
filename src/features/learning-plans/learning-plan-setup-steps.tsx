import { ActivityIndicator, View } from "react-native";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import {
	type LoadMaterialPreview,
	MaterialUploadGrid,
} from "~/features/learning-plans/material-upload-grid";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { useDayovaTheme } from "~/lib/theme";

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
				Deine Unterlagen bilden die Grundlage für deinen Lernplan.
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
	canContinue,
	errorMessage,
	isBusy,
	onChangeTopics,
	onContinue,
	topics,
}: {
	canContinue: boolean;
	errorMessage: string | null;
	isBusy: boolean;
	onChangeTopics: (value: string) => void;
	onContinue: () => void;
	topics: string;
}) {
	return (
		<View className="flex-1">
			<Text className="font-poppins font-semibold text-body-1 text-text">
				Welche Themen kommen in der Prüfung dran?
			</Text>
			<Text className="mt-3 font-poppins text-body-3 text-secondary-text">
				Nenne alle Themen, die du für diese Prüfung lernen musst.
			</Text>
			<Textarea
				accessibilityLabel="Prüfungsthemen"
				className="mt-6 h-48 flex-none rounded-[24px] border border-border bg-card px-4 py-4"
				value={topics}
				onChangeText={onChangeTopics}
				placeholder="Zum Beispiel: Lineare Funktionen, Steigung berechnen und den y-Achsenabschnitt bestimmen."
			/>

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
