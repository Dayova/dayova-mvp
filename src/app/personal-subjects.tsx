import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader } from "~/components/screen-header";
import { AddIcon } from "~/components/ui/add-icon";
import { Button } from "~/components/ui/button";
import { ConfirmationSheet } from "~/components/ui/confirmation-sheet";
import {
	DayovaSheetFrame,
	DayovaSheetInput,
} from "~/components/ui/dayova-sheet-frame";
import { ErrorMessage } from "~/components/ui/error-message";
import { BookOpen, Pencil, Trash2 } from "~/components/ui/icon";
import { PortraitContent } from "~/components/ui/portrait-content";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import {
	cleanSubjectName,
	correctSubjectName,
} from "~/features/subjects/subject-definitions";
import { SubjectAddFlow } from "~/features/subjects/subject-picker";
import { useSubjectOptions } from "~/features/subjects/use-subject-options";
import { createAsyncActionGate } from "~/lib/async-action-gate";
import { useDayovaTheme } from "~/lib/theme";
import { getUserFacingErrorMessage } from "~/lib/user-facing-errors";

type EditingSubject = {
	id: Id<"personalSubjects">;
	name: string;
};

export default function PersonalSubjectsScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { colors } = useDayovaTheme();
	const { isLoading, loadError, personalOptions, options, savePermanent } =
		useSubjectOptions();
	const [isAdding, setIsAdding] = useState(false);
	const renameSubject = useMutation(api.personalSubjects.rename);
	const removeSubject = useMutation(api.personalSubjects.remove);
	const [editingSubject, setEditingSubject] = useState<EditingSubject | null>(
		null,
	);
	const [renamedValue, setRenamedValue] = useState("");
	const [deletingSubject, setDeletingSubject] = useState<EditingSubject | null>(
		null,
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isBusy, setIsBusy] = useState(false);
	const actionGateRef = useRef(createAsyncActionGate());

	const startRename = (subject: EditingSubject) => {
		setErrorMessage(null);
		setRenamedValue(subject.name);
		setEditingSubject(subject);
	};
	const runAction = (task: () => Promise<void>) => {
		void actionGateRef.current.run(async () => {
			setIsBusy(true);
			setErrorMessage(null);
			try {
				await task();
			} catch (error) {
				setErrorMessage(
					getUserFacingErrorMessage(
						error,
						"Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.",
						{ source: "personal-subjects.settings" },
					),
				);
			} finally {
				setIsBusy(false);
			}
		});
	};
	const confirmRename = () => {
		if (!editingSubject) return;
		const name = correctSubjectName(renamedValue);
		if (!name) {
			setErrorMessage("Gib einen Fachnamen ein.");
			return;
		}
		if (name === editingSubject.name) {
			setEditingSubject(null);
			return;
		}
		runAction(async () => {
			await renameSubject({ id: editingSubject.id, name });
			Keyboard.dismiss();
			setEditingSubject(null);
		});
	};
	const confirmDelete = () => {
		if (!deletingSubject) return;
		runAction(async () => {
			await removeSubject({ id: deletingSubject.id });
			setDeletingSubject(null);
		});
	};

	return (
		<>
			<Screen>
				<ThemedStatusBar />
				<PortraitContent
					className="bg-background px-6"
					style={{ paddingTop: Math.max(insets.top + 28, 64) }}
				>
					<ScreenHeader
						title="Persönliche Fächer"
						onBack={() => router.back()}
						right={
							<Pressable
								accessibilityRole="button"
								accessibilityLabel="Persönliches Fach hinzufügen"
								onPress={() => setIsAdding(true)}
								className="h-12 w-12 items-center justify-center rounded-full active:opacity-80"
							>
								<AddIcon />
							</Pressable>
						}
					/>
				</PortraitContent>
				<ScreenScroll
					includeTopSafeArea={false}
					topPadding={24}
					bottomPadding={80}
					horizontalPadding={24}
				>
					<Text className="mb-5 font-poppins text-body-3 text-secondary-text">
						Diese Fächer stehen dir bei Prüfungen, Hausaufgaben, Lernplänen und
						im Stundenplan zur Verfügung.
					</Text>

					{isLoading ? (
						<View
							accessibilityLabel="Persönliche Fächer werden geladen"
							accessibilityRole="progressbar"
							className="min-h-32 items-center justify-center"
						>
							<ActivityIndicator color={colors.primary} />
						</View>
					) : loadError ? (
						<ErrorMessage>{loadError}</ErrorMessage>
					) : personalOptions.length === 0 ? (
						<Surface className="items-center border border-border px-6 py-10">
							<View className="h-14 w-14 items-center justify-center rounded-full bg-muted">
								<BookOpen size={26} color={colors.text} strokeWidth={2} />
							</View>
							<Text className="mt-5 text-center font-poppins font-semibold text-body-2 text-text">
								Noch keine persönlichen Fächer
							</Text>
							<Text className="mt-2 text-center font-poppins text-body-4 text-secondary-text">
								Füge dein erstes persönliches Fach hinzu, damit du es überall
								wieder auswählen kannst.
							</Text>
							<Button
								onPress={() => setIsAdding(true)}
								size="sm"
								className="mt-5"
							>
								<AddIcon />
								<Text className="text-body-4">
									Persönliches Fach hinzufügen
								</Text>
							</Button>
						</Surface>
					) : (
						<View className="gap-3">
							{personalOptions.map((subject) => (
								<ReanimatedSwipeable
									key={subject.key}
									overshootRight={false}
									rightThreshold={40}
									renderRightActions={(_progress, _translation, swipeable) => (
										<Pressable
											accessibilityLabel={`${subject.name} löschen`}
											accessibilityRole="button"
											className="ml-2 w-24 items-center justify-center rounded-card bg-destructive"
											onPress={() => {
												swipeable.close();
												setErrorMessage(null);
												setDeletingSubject({
													id: subject.personalSubjectId as Id<"personalSubjects">,
													name: subject.name,
												});
											}}
										>
											<Trash2 size={22} color="#FFFFFF" strokeWidth={2} />
											<Text className="mt-1 font-poppins text-body-4 text-white">
												Löschen
											</Text>
										</Pressable>
									)}
								>
									<Surface className="min-h-18 flex-row items-center border border-border px-5 py-3">
										<View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
											<subject.Icon
												size={20}
												color={colors.text}
												strokeWidth={2}
											/>
										</View>
										<Text className="ml-4 flex-1 font-poppins font-semibold text-body-2 text-text">
											{subject.name}
										</Text>
										<Pressable
											accessibilityLabel={`${subject.name} umbenennen`}
											accessibilityRole="button"
											className="h-11 w-11 items-center justify-center rounded-full active:bg-muted"
											onPress={() =>
												startRename({
													id: subject.personalSubjectId as Id<"personalSubjects">,
													name: subject.name,
												})
											}
										>
											<Pencil size={19} color={colors.text} strokeWidth={2} />
										</Pressable>
									</Surface>
								</ReanimatedSwipeable>
							))}
						</View>
					)}
				</ScreenScroll>
			</Screen>

			{isAdding ? (
				<SubjectAddFlow
					options={options}
					onCancel={() => setIsAdding(false)}
					onSelect={() => setIsAdding(false)}
					onSavePermanent={savePermanent}
				/>
			) : null}

			<DayovaSheetFrame
				visible={Boolean(editingSubject)}
				title="Fach umbenennen"
				description="Der neue Name wird auch bei verknüpften Prüfungen, Hausaufgaben und Lernplänen angezeigt."
				onClose={() => {
					if (!isBusy) setEditingSubject(null);
				}}
				dismissible={!isBusy}
				closeAccessibilityLabel="Umbenennen schließen"
				scrollable
				size="content"
			>
				<View className="gap-4">
					<View className="min-h-16 flex-row items-center rounded-input border border-border bg-card px-5">
						<DayovaSheetInput
							accessibilityLabel="Neuer Fachname"
							autoCapitalize="sentences"
							autoCorrect
							spellCheck
							maxLength={60}
							returnKeyType="done"
							value={renamedValue}
							onChangeText={setRenamedValue}
							onSubmitEditing={confirmRename}
						/>
					</View>
					{editingSubject && errorMessage ? (
						<ErrorMessage>{errorMessage}</ErrorMessage>
					) : null}
					<Button
						accessibilityState={{ busy: isBusy, disabled: isBusy }}
						disabled={!cleanSubjectName(renamedValue) || isBusy}
						onPress={confirmRename}
					>
						{isBusy ? <ActivityIndicator color="#FFFFFF" /> : null}
						<Text>{isBusy ? "Wird gespeichert …" : "Namen speichern"}</Text>
					</Button>
				</View>
			</DayovaSheetFrame>

			<ConfirmationSheet
				visible={Boolean(deletingSubject)}
				title="Persönliches Fach löschen?"
				description={`${deletingSubject?.name ?? "Das Fach"} wird nicht mehr zur Auswahl angeboten. Bereits gespeicherte Einträge behalten ihren bisherigen Fachnamen.`}
				confirmLabel="Fach löschen"
				isBusy={isBusy}
				errorMessage={deletingSubject ? errorMessage : null}
				onClose={() => {
					if (!isBusy) setDeletingSubject(null);
				}}
				onConfirm={confirmDelete}
			/>
		</>
	);
}
