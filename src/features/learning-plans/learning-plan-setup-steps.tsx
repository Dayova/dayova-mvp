import { ActivityIndicator, View } from "react-native";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { GraduationCap, Plus } from "~/components/ui/icon";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { MaterialCard } from "~/features/learning-plans/learning-plan-ui";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { useDayovaTheme } from "~/lib/theme";

type PendingUploadAction = "camera" | "files";

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
	const { colors } = useDayovaTheme();
	const schoolDocuments = documents.filter(
		(document) => document.sourceKind === "school",
	);
	const hasSchoolMaterial = schoolDocuments.length > 0;

	return (
		<View className="flex-1">
			<Text className="font-poppins font-semibold text-body-1 text-text">
				Schulmaterial hinzufügen
			</Text>
			<Text className="mt-2 font-poppins text-body-3 text-secondary-text">
				Deine Unterlagen bilden die Grundlage für deinen Lernplan.
			</Text>

			<ActionSurface
				accessibilityHint="Öffnet die Auswahl zum Scannen oder Hochladen von Schulmaterial."
				accessibilityLabel={
					hasSchoolMaterial
						? "Weiteres Schulmaterial hinzufügen"
						: "Schulmaterial hinzufügen"
				}
				accessibilityRole="button"
				disabled={!canUpload}
				onPress={() => onOpenUpload()}
				className="mt-7 min-h-[112px] flex-row items-center rounded-[32px] px-5 py-5"
				variant="soft"
			>
				<View className="h-12 w-12 items-center justify-center rounded-[18px] bg-system-subtle">
					<GraduationCap
						size={24}
						color={colors.primaryStrong}
						strokeWidth={2.1}
					/>
				</View>
				<View className="min-w-0 flex-1 px-4">
					<Text className="font-poppins font-semibold text-body-2 text-text">
						{hasSchoolMaterial
							? "Weiteres Schulmaterial"
							: "Schulmaterial hochladen"}
					</Text>
					<Text className="mt-1 font-poppins text-body-4 text-secondary-text">
						Themenblatt, Arbeitsblätter oder Mitschriften
					</Text>
				</View>
				<Plus size={22} color={colors.primaryStrong} strokeWidth={2.2} />
			</ActionSurface>

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
				className="mt-6 h-48 flex-none rounded-[24px] bg-card px-4 py-4"
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
