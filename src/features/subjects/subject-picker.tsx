import { useRef, useState } from "react";
import {
	ActivityIndicator,
	Keyboard,
	type TextInput,
	View,
} from "react-native";
import { AddOptionButton } from "~/components/ui/add-option-button";
import { Button } from "~/components/ui/button";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { ErrorMessage } from "~/components/ui/error-message";
import { Input } from "~/components/ui/input";
import { SelectionOptionRow } from "~/components/ui/selection-option-row";
import { Text } from "~/components/ui/text";
import { getSubjectIcon } from "~/features/subjects/subject-catalog";
import {
	correctSubjectName,
	normalizeSubjectName,
} from "~/features/subjects/subject-definitions";
import {
	type SubjectOption,
	type SubjectSelection,
	useSubjectOptions,
} from "~/features/subjects/use-subject-options";
import { useDayovaTheme } from "~/lib/theme";
import { getUserFacingErrorMessage } from "~/lib/user-facing-errors";

const MAX_SUBJECT_NAME_LENGTH = 60;

function SubjectPickerContent({
	options,
	selected,
	isLoading,
	loadError,
	onSelect,
	onAdd,
}: {
	options: SubjectOption[];
	selected: SubjectSelection;
	isLoading: boolean;
	loadError?: string | null;
	onSelect: (selection: SubjectSelection) => void;
	onAdd: () => void;
}) {
	const { colors } = useDayovaTheme();
	const visibleOptions = [...options];
	// Keep a just-saved or one-time selection visible until the catalog catches up.
	if (selected.name && (selected.personalSubjectId || selected.isOneTime)) {
		const match = visibleOptions.findIndex((option) =>
			selected.personalSubjectId
				? option.personalSubjectId === selected.personalSubjectId
				: normalizeSubjectName(option.name) ===
					normalizeSubjectName(selected.name),
		);
		if (match < 0) {
			const pendingOption: SubjectOption = {
				...selected,
				key: selected.personalSubjectId
					? `personal:${selected.personalSubjectId}`
					: `one-time:${normalizeSubjectName(selected.name)}`,
				kind: selected.personalSubjectId ? "personal" : "oneTime",
				Icon: getSubjectIcon(selected.name),
			};
			const sameName = visibleOptions.findIndex(
				(option) =>
					normalizeSubjectName(option.name) ===
					normalizeSubjectName(selected.name),
			);
			if (sameName >= 0) visibleOptions[sameName] = pendingOption;
			else visibleOptions.push(pendingOption);
		}
	}
	const selectionFor = (option: SubjectOption): SubjectSelection => ({
		name: option.name,
		...(option.personalSubjectId
			? { personalSubjectId: option.personalSubjectId }
			: {}),
		...(option.isOneTime ? { isOneTime: true } : {}),
	});
	const isSelected = (option: SubjectOption) =>
		option.personalSubjectId
			? option.personalSubjectId === selected.personalSubjectId
			: !selected.personalSubjectId &&
				normalizeSubjectName(option.name) ===
					normalizeSubjectName(selected.name);

	return (
		<View accessibilityRole="radiogroup" className="gap-3">
			{visibleOptions.map((option) => (
				<SelectionOptionRow
					key={option.key}
					Icon={option.Icon}
					label={option.name}
					description={option.isOneTime ? "Nur für diesen Eintrag" : undefined}
					selected={isSelected(option)}
					onPress={() => onSelect(selectionFor(option))}
				/>
			))}

			{loadError ? <ErrorMessage>{loadError}</ErrorMessage> : null}

			{isLoading ? (
				<View
					accessibilityLabel="Persönliche Fächer werden geladen"
					accessibilityRole="progressbar"
					className="min-h-14 items-center justify-center"
				>
					<ActivityIndicator color={colors.primary} />
				</View>
			) : null}

			<AddOptionButton label="Fach hinzufügen" onPress={onAdd} />
		</View>
	);
}

function SubjectAddFlow({
	options,
	onCancel,
	onSelect,
	onSavePermanent,
}: {
	options: SubjectOption[];
	onCancel: () => void;
	onSelect: (selection: SubjectSelection) => void;
	onSavePermanent: (name: string) => Promise<SubjectSelection>;
}) {
	const inputRef = useRef<TextInput>(null);
	const savingRef = useRef(false);
	const [name, setName] = useState("");
	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const cleanedName = correctSubjectName(name);
	const submitLabel = isBusy ? "Wird gespeichert …" : "Fach hinzufügen";

	const finish = (selection: SubjectSelection) => {
		Keyboard.dismiss();
		onSelect(selection);
	};
	const cancel = () => {
		if (savingRef.current) return;
		Keyboard.dismiss();
		onCancel();
	};
	const continueFromInput = () => {
		if (savingRef.current) return;
		setErrorMessage(null);
		if (!cleanedName) {
			setErrorMessage("Gib einen Fachnamen ein.");
			return;
		}
		const existing =
			options.find(
				(option) =>
					normalizeSubjectName(option.name) === normalizeSubjectName(name),
			) ??
			options.find(
				(option) =>
					normalizeSubjectName(option.name) ===
					normalizeSubjectName(cleanedName),
			);
		if (
			existing &&
			(existing.kind === "builtIn" || existing.personalSubjectId)
		) {
			finish({
				name: existing.name,
				...(existing.personalSubjectId
					? { personalSubjectId: existing.personalSubjectId }
					: {}),
			});
			return;
		}
		void savePermanent(existing?.name ?? cleanedName);
	};
	const savePermanent = async (value = cleanedName) => {
		if (savingRef.current) return;
		savingRef.current = true;
		setIsBusy(true);
		setErrorMessage(null);
		try {
			finish(await onSavePermanent(value));
		} catch (error) {
			setErrorMessage(
				getUserFacingErrorMessage(
					error,
					"Das Fach konnte nicht gespeichert werden. Bitte versuche es erneut.",
					{ source: "personal-subjects" },
				),
			);
		} finally {
			savingRef.current = false;
			setIsBusy(false);
		}
	};

	return (
		<DayovaSheetFrame
			visible
			title="Fach hinzufügen"
			description="Dein persönliches Fach wird gespeichert und steht dir bei Prüfungen, Hausaufgaben, Lernplänen und im Stundenplan zur Verfügung."
			onClose={cancel}
			onPresented={() => inputRef.current?.focus()}
			dismissible={!isBusy}
			closeAccessibilityLabel="Fach hinzufügen schließen"
			scrollable
		>
			<View className="gap-4">
				<View className="min-h-16 flex-row items-center rounded-input border border-border bg-card px-5">
					<Input
						ref={inputRef}
						accessibilityLabel="Name des Fachs"
						autoCapitalize="sentences"
						autoCorrect
						spellCheck
						maxLength={MAX_SUBJECT_NAME_LENGTH}
						placeholder="Zum Beispiel Französisch"
						returnKeyType="done"
						editable={!isBusy}
						value={name}
						onChangeText={setName}
						onSubmitEditing={continueFromInput}
					/>
				</View>
				{errorMessage ? <ErrorMessage>{errorMessage}</ErrorMessage> : null}
				<Button
					accessibilityState={{ busy: isBusy }}
					accessibilityLabel={submitLabel}
					accessibilityLiveRegion={isBusy ? "polite" : undefined}
					disabled={!cleanedName || isBusy}
					onPress={continueFromInput}
				>
					{isBusy ? (
						<ActivityIndicator
							accessible
							color="#FFFFFF"
							accessibilityRole="progressbar"
							accessibilityLabel="Fach wird gespeichert"
						/>
					) : null}
					<Text>{submitLabel}</Text>
				</Button>
				<Button disabled={isBusy} variant="cancel" onPress={cancel}>
					<Text>Abbrechen</Text>
				</Button>
			</View>
		</DayovaSheetFrame>
	);
}

function InlineSubjectPicker({
	selected,
	onSelect,
}: {
	selected: SubjectSelection;
	onSelect: (selection: SubjectSelection) => void;
}) {
	const { isLoading, loadError, options, savePermanent } = useSubjectOptions();
	const [isAdding, setIsAdding] = useState(false);

	return (
		<>
			<SubjectPickerContent
				options={options}
				selected={selected}
				isLoading={isLoading}
				loadError={loadError}
				onSelect={onSelect}
				onAdd={() => setIsAdding(true)}
			/>
			{isAdding ? (
				<SubjectAddFlow
					options={options}
					onCancel={() => setIsAdding(false)}
					onSelect={(selection) => {
						onSelect(selection);
						setIsAdding(false);
					}}
					onSavePermanent={savePermanent}
				/>
			) : null}
		</>
	);
}

function SubjectPickerSheet({
	visible,
	selected,
	onClose,
	onSelect,
}: {
	visible: boolean;
	selected: SubjectSelection;
	onClose: () => void;
	onSelect: (selection: SubjectSelection) => void;
}) {
	const { isLoading, loadError, options, savePermanent } = useSubjectOptions();
	const [isAdding, setIsAdding] = useState(false);
	const finish = (selection: SubjectSelection) => {
		onSelect(selection);
		setIsAdding(false);
		onClose();
	};

	return (
		<>
			<DayovaSheetFrame
				visible={visible && !isAdding}
				title="Schulfach auswählen"
				onClose={onClose}
				closeAccessibilityLabel="Fachauswahl schließen"
				contentClassName="gap-3"
				scrollable
			>
				<SubjectPickerContent
					options={options}
					selected={selected}
					isLoading={isLoading}
					loadError={loadError}
					onSelect={finish}
					onAdd={() => setIsAdding(true)}
				/>
			</DayovaSheetFrame>
			{visible && isAdding ? (
				<SubjectAddFlow
					options={options}
					onCancel={() => setIsAdding(false)}
					onSelect={finish}
					onSavePermanent={savePermanent}
				/>
			) : null}
		</>
	);
}

export {
	InlineSubjectPicker,
	SubjectAddFlow,
	SubjectPickerContent,
	SubjectPickerSheet,
};
