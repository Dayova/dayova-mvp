import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import type { Id } from "#convex/_generated/dataModel";
import { IntroUploadArtwork } from "~/components/intro-upload-artwork";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { WarningBanner } from "~/components/ui/warning-banner";
import { MaterialCard } from "~/features/learning-plans/learning-plan-ui";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";

type PendingUploadAction = "camera" | "files";

function SetupContinueButton({
	canContinue,
	isBusy,
	onPress,
}: {
	canContinue: boolean;
	isBusy: boolean;
	onPress: () => void;
}) {
	return (
		<Button
			accessibilityLabel={isBusy ? "Weiter, wird geladen" : "Weiter"}
			accessibilityLiveRegion={isBusy ? "polite" : undefined}
			accessibilityState={{ busy: isBusy, disabled: !canContinue }}
			disabled={!canContinue}
			onPress={onPress}
		>
			{isBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text>Weiter</Text>}
		</Button>
	);
}

export function MaterialUploadStep({
	artworkHeight,
	artworkWidth,
	canContinue,
	documents,
	errorMessage,
	isBusy,
	onContinue,
	onOpenUpload,
	onRemoveDocument,
	openingUploadAction,
}: {
	artworkHeight: number;
	artworkWidth: number;
	canContinue: boolean;
	documents: LearningPlanSnapshot["documents"];
	errorMessage: string | null;
	isBusy: boolean;
	onContinue: () => void;
	onOpenUpload: () => void;
	onRemoveDocument: (id: Id<"learningPlanDocuments">) => void;
	openingUploadAction: PendingUploadAction | null;
}) {
	return (
		<View className="flex-1 items-center">
			<TouchableOpacity
				accessibilityHint="Öffnet die Auswahl zum Scannen oder Hochladen von Dateien."
				accessibilityLabel="Schulmaterial hinzufügen"
				accessibilityRole="button"
				accessibilityState={{ disabled: !canContinue }}
				activeOpacity={0.86}
				disabled={!canContinue}
				onPress={onOpenUpload}
				className="relative overflow-hidden rounded-[32px]"
				style={{
					// The dimensions follow the runtime viewport; borderCurve is a
					// native-only rendering property without a NativeWind utility.
					width: artworkWidth,
					height: artworkHeight,
					borderCurve: "continuous",
				}}
			>
				<IntroUploadArtwork width={artworkWidth} height={artworkHeight} />
				{isBusy || openingUploadAction ? (
					<View className="absolute inset-0 items-center justify-center rounded-[32px] bg-surface/80">
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
				{documents.map((document) => (
					<MaterialCard
						key={document.id}
						name={document.fileName}
						size={document.fileSizeBytes}
						onRemove={() => onRemoveDocument(document.id)}
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
				<SetupContinueButton
					canContinue={canContinue}
					isBusy={isBusy}
					onPress={onContinue}
				/>
			</View>
		</View>
	);
}

export function TopicDescriptionStep({
	canContinue,
	errorMessage,
	isBusy,
	onChangeTopicDescription,
	onContinue,
	onOpenLearningTimes,
	showLearningTimesWarning,
	topicDescription,
}: {
	canContinue: boolean;
	errorMessage: string | null;
	isBusy: boolean;
	onChangeTopicDescription: (value: string) => void;
	onContinue: () => void;
	onOpenLearningTimes: () => void;
	showLearningTimesWarning: boolean;
	topicDescription: string;
}) {
	return (
		<View className="flex-1">
			{showLearningTimesWarning ? (
				<WarningBanner
					className="mb-7"
					title="Lernzeiten fehlen"
					description="Ohne Lernzeiten weiß Dayova nicht, wann der Lernplan eingetragen werden soll. Lege mindestens eine Lernzeit an, damit wir deinen Plan erstellen können."
					ctaLabel="Lernzeiten eintragen"
					onPressCta={onOpenLearningTimes}
				/>
			) : null}
			<Text className="font-poppins font-semibold text-body-1 text-text">
				Welche Themen kommen in deiner Prüfung dran?
			</Text>
			<Text className="mt-2 font-poppins text-body-3 text-secondary-text">
				Nenne die wichtigsten Inhalte, Kapitel oder Schwerpunkte.
			</Text>
			<Textarea
				autoFocus
				accessibilityLabel="Prüfungsthemen"
				className="mt-4 min-h-[180px] flex-1 py-2"
				value={topicDescription}
				onChangeText={onChangeTopicDescription}
				placeholder="Beschreibe kurz deine Prüfungsthemen."
			/>
			{errorMessage ? (
				<Text
					selectable
					accessibilityRole="alert"
					className="mt-4 font-poppins text-body-4 text-destructive"
				>
					{errorMessage}
				</Text>
			) : null}
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
