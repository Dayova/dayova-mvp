import { useRef, useState } from "react";
import {
	ActivityIndicator,
	Keyboard,
	Pressable,
	type TextInput,
	View,
} from "react-native";
import { AddIcon } from "~/components/ui/add-icon";
import { Button } from "~/components/ui/button";
import {
	DayovaSheetFrame,
	DayovaSheetInput,
} from "~/components/ui/dayova-sheet-frame";
import { ErrorMessage } from "~/components/ui/error-message";
import { Check } from "~/components/ui/icon";
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
import { cn } from "~/lib/utils";

const MAX_SUBJECT_NAME_LENGTH = 60;

function SubjectOptionRow({
	option,
	selected,
	onPress,
}: {
	option: SubjectOption;
	selected: boolean;
	onPress: () => void;
}) {
	const { colors } = useDayovaTheme();
	const Icon = option.Icon;

	return (
		<Pressable
			accessibilityLabel={option.name}
			accessibilityRole="radio"
			accessibilityState={{ checked: selected }}
			className={cn(
				"min-h-16 flex-row items-center gap-4 rounded-[22px] border px-5 py-3 active:opacity-80",
				selected ? "border-primary/40 bg-accent" : "border-border bg-card",
			)}
			onPress={onPress}
		>
			<View className="h-9 w-9 items-center justify-center rounded-full bg-system-subtle">
				<Icon
					size={20}
					color={selected ? colors.primary : colors.secondaryText}
					strokeWidth={2}
				/>
			</View>
			<Text
				className={cn(
					"flex-1 font-poppins text-body-2",
					selected ? "font-semibold text-primary" : "text-text",
				)}
			>
				{option.name}
			</Text>
			<View
				className={cn(
					"h-6 w-6 items-center justify-center rounded-full border-2",
					selected ? "border-primary bg-primary" : "border-primary/40",
				)}
			>
				{selected ? (
					<Check size={14} color="#FFFFFF" strokeWidth={2.5} />
				) : null}
			</View>
		</Pressable>
	);
}

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
	const regularOptions = [...options];
	// Show a newly saved subject immediately, before the reactive catalog catches up.
	if (
		selected.personalSubjectId &&
		!regularOptions.some(
			(option) => option.personalSubjectId === selected.personalSubjectId,
		)
	) {
		regularOptions.push({
			...selected,
			key: `personal:${selected.personalSubjectId}`,
			kind: "personal",
			Icon: getSubjectIcon(selected.name),
		});
	}
	const isSelected = (option: SubjectOption) =>
		option.personalSubjectId
			? option.personalSubjectId === selected.personalSubjectId
			: !selected.personalSubjectId &&
				normalizeSubjectName(option.name) ===
					normalizeSubjectName(selected.name);

	return (
		<View accessibilityRole="radiogroup" className="gap-3">
			{regularOptions.map((option) => (
				<SubjectOptionRow
					key={option.key}
					option={option}
					selected={isSelected(option)}
					onPress={() =>
						onSelect({
							name: option.name,
							...(option.personalSubjectId
								? { personalSubjectId: option.personalSubjectId }
								: {}),
						})
					}
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

			<Pressable
				accessibilityLabel="Fach hinzufügen"
				accessibilityRole="button"
				className="min-h-16 flex-row items-center gap-4 rounded-[22px] border border-primary/50 border-dashed bg-card px-5 py-3 active:opacity-80"
				onPress={onAdd}
			>
				<AddIcon />
				<Text className="flex-1 font-poppins font-semibold text-body-2 text-primary">
					Fach hinzufügen
				</Text>
			</Pressable>
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
	const save = async () => {
		if (!cleanedName || savingRef.current) return;
		savingRef.current = true;
		setIsBusy(true);
		setErrorMessage(null);
		try {
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
			const selection =
				existing && existing.kind !== "timetable"
					? {
							name: existing.name,
							...(existing.personalSubjectId
								? { personalSubjectId: existing.personalSubjectId }
								: {}),
						}
					: await onSavePermanent(existing?.name ?? cleanedName);
			Keyboard.dismiss();
			onSelect(selection);
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
	const cancel = () => {
		if (!savingRef.current) {
			Keyboard.dismiss();
			onCancel();
		}
	};
	return (
		<DayovaSheetFrame
			visible
			title="Fach hinzufügen"
			description="Dein persönliches Fach wird gespeichert und steht dir bei Prüfungen, Hausaufgaben und Lernplänen zur Verfügung."
			onClose={cancel}
			onPresented={() => inputRef.current?.focus()}
			dismissible={!isBusy}
			closeAccessibilityLabel="Fach hinzufügen schließen"
			scrollable
			size="content"
		>
			<View className="gap-4">
				<View className="min-h-16 flex-row items-center rounded-input border border-border bg-card px-5">
					<DayovaSheetInput
						ref={inputRef}
						accessibilityLabel="Name des Fachs"
						autoCapitalize="sentences"
						autoCorrect
						spellCheck
						maxLength={MAX_SUBJECT_NAME_LENGTH}
						placeholder="Zum Beispiel Französisch"
						returnKeyType="done"
						value={name}
						onChangeText={setName}
						editable={!isBusy}
						onSubmitEditing={() => void save()}
					/>
				</View>
				{errorMessage ? <ErrorMessage>{errorMessage}</ErrorMessage> : null}
				<Button
					disabled={!cleanedName || isBusy}
					accessibilityState={{ busy: isBusy }}
					onPress={() => void save()}
				>
					{isBusy ? <ActivityIndicator color="#FFFFFF" /> : null}
					<Text>{isBusy ? "Wird gespeichert …" : "Fach hinzufügen"}</Text>
				</Button>
				<Button
					disabled={isBusy}
					variant="ghost"
					className="border border-border bg-card"
					onPress={cancel}
				>
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
				size="content"
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
	SubjectOptionRow,
	SubjectPickerContent,
	SubjectPickerSheet,
};
