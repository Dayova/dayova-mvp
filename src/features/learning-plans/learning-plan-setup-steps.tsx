import { ActivityIndicator, View } from "react-native";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { Globe, GraduationCap, Plus } from "~/components/ui/icon";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { WarningBanner } from "~/components/ui/warning-banner";
import { MaterialCard } from "~/features/learning-plans/learning-plan-ui";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";

type PendingUploadAction = "camera" | "files";
type MaterialSourceKind = "school" | "external";

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
	canContinue,
	documents,
	errorMessage,
	isBusy,
	onContinue,
	onOpenUpload,
	onRemoveDocument,
	openingUploadAction,
}: {
	canContinue: boolean;
	documents: LearningPlanSnapshot["documents"];
	errorMessage: string | null;
	isBusy: boolean;
	onContinue: () => void;
	onOpenUpload: (sourceKind: MaterialSourceKind) => void;
	onRemoveDocument: (id: Id<"learningPlanDocuments">) => void;
	openingUploadAction: PendingUploadAction | null;
}) {
	const schoolDocuments = documents.filter(
		(document) => document.sourceKind === "school",
	);
	const externalDocuments = documents.filter(
		(document) => document.sourceKind === "external",
	);

	return (
		<View className="flex-1">
			<Text className="font-poppins font-semibold text-body-1 text-text">
				Gib Dayova deine Unterlagen
			</Text>
			<Text className="mt-2 font-poppins text-body-3 text-secondary-text">
				Schulmaterial bestimmt den wahrscheinlichen Prüfungsstoff. Zusätzliche
				Lernhilfen unterstützen später beim Verstehen und Üben.
			</Text>

			<View className="mt-7 gap-4">
				<ActionSurface
					accessibilityHint="Öffnet die Auswahl für Unterlagen deiner Schule oder Lehrkraft."
					accessibilityLabel="Material von deiner Schule hinzufügen"
					accessibilityRole="button"
					disabled={!canContinue}
					onPress={() => onOpenUpload("school")}
					className="min-h-[132px] flex-row items-center rounded-[32px] px-5 py-5"
					variant="soft"
				>
					<View className="h-14 w-14 items-center justify-center rounded-[20px] bg-system-subtle">
						<GraduationCap size={27} color="#00A0E6" strokeWidth={2.1} />
					</View>
					<View className="min-w-0 flex-1 px-4">
						<Text className="font-poppins font-semibold text-body-2 text-text">
							Von deiner Schule
						</Text>
						<Text className="mt-1 font-poppins text-body-4 text-secondary-text">
							Themenblatt, Arbeitsblätter, Mitschriften oder Hinweise deiner
							Lehrkraft
						</Text>
					</View>
					<Plus size={22} color="#00A0E6" strokeWidth={2.2} />
				</ActionSurface>

				<ActionSurface
					accessibilityHint="Öffnet die Auswahl für zusätzliche externe Lernhilfen."
					accessibilityLabel="Zusätzliche Lernhilfe hinzufügen"
					accessibilityRole="button"
					disabled={!canContinue}
					onPress={() => onOpenUpload("external")}
					className="min-h-[118px] flex-row items-center rounded-[32px] px-5 py-5"
					variant="flat"
				>
					<View className="h-14 w-14 items-center justify-center rounded-[20px] bg-light-2">
						<Globe size={27} color="#697586" strokeWidth={2.1} />
					</View>
					<View className="min-w-0 flex-1 px-4">
						<Text className="font-poppins font-semibold text-body-2 text-text">
							Zusätzliche Lernhilfen
						</Text>
						<Text className="mt-1 font-poppins text-body-4 text-secondary-text">
							Optional · Erklärungen oder Materialien aus anderen Quellen
						</Text>
					</View>
					<Plus size={22} color="#697586" strokeWidth={2.2} />
				</ActionSurface>
			</View>

			{isBusy || openingUploadAction ? (
				<View className="mt-5 flex-row items-center gap-3 rounded-[24px] bg-system-subtle px-4 py-4">
					<ActivityIndicator color="#00A0E6" />
					<Text className="flex-1 font-poppins text-body-4 text-secondary-text">
						{openingUploadAction === "files"
							? "Dateiauswahl wird geöffnet …"
							: openingUploadAction === "camera"
								? "Kamera wird geöffnet …"
								: "Material wird hochgeladen …"}
					</Text>
				</View>
			) : null}

			{schoolDocuments.length > 0 ? (
				<View className="mt-7">
					<Text className="mb-3 font-poppins font-semibold text-body-4 text-secondary-text">
						Von deiner Schule
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

			{externalDocuments.length > 0 ? (
				<View className="mt-4">
					<Text className="mb-3 font-poppins font-semibold text-body-4 text-secondary-text">
						Zusätzliche Lernhilfen
					</Text>
					{externalDocuments.map((document) => (
						<MaterialCard
							key={document.id}
							name={document.fileName}
							size={document.fileSizeBytes}
							onRemove={() => onRemoveDocument(document.id)}
						/>
					))}
				</View>
			) : null}

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

export function TeacherGuidanceStep({
	canContinue,
	errorMessage,
	hasSchoolMaterial,
	isBusy,
	onChangeTeacherGuidance,
	onContinue,
	onOpenLearningTimes,
	showLearningTimesWarning,
	teacherGuidance,
}: {
	canContinue: boolean;
	errorMessage: string | null;
	hasSchoolMaterial: boolean;
	isBusy: boolean;
	onChangeTeacherGuidance: (value: string) => void;
	onContinue: () => void;
	onOpenLearningTimes: () => void;
	showLearningTimesWarning: boolean;
	teacherGuidance: string;
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
				Was hat deine Lehrkraft zur Arbeit gesagt?
			</Text>
			<Text className="mt-2 font-poppins text-body-3 text-secondary-text">
				Schreibe nur auf, was ausdrücklich genannt wurde. Dayova leitet den
				Prüfungsstoff anschließend aus diesem Hinweis und deinem Schulmaterial
				ab.
			</Text>
			<Textarea
				accessibilityLabel="Hinweis der Lehrkraft"
				className="mt-4 min-h-[160px] flex-1 py-2"
				value={teacherGuidance}
				onChangeText={onChangeTeacherGuidance}
				placeholder="Zum Beispiel: Kapitel 3 und 4, keine Beweisaufgaben."
			/>
			{hasSchoolMaterial ? (
				<Text className="mt-3 font-poppins text-body-4 text-secondary-text">
					Optional – dein hochgeladenes Schulmaterial reicht als Grundlage.
				</Text>
			) : (
				<Text className="mt-3 font-poppins text-body-4 text-secondary-text">
					Ohne Schulmaterial brauchen wir hier mindestens einen konkreten
					Hinweis deiner Lehrkraft.
				</Text>
			)}
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
