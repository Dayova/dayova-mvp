import { useRef, useState } from "react";
import {
	ActivityIndicator,
	Keyboard,
	Pressable,
	type TextInput,
	View,
} from "react-native";
import { AddOptionButton } from "~/components/ui/add-option-button";
import { Button } from "~/components/ui/button";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { ErrorMessage } from "~/components/ui/error-message";
import { Check } from "~/components/ui/icon";
import { Input } from "~/components/ui/input";
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
				"min-h-16 flex-row items-center gap-4 rounded-3xl border px-5 py-3 active:opacity-80",
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
					<Check size={14} color={colors.onPrimary} strokeWidth={2.5} />
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
	const builtInOptions = options.filter((option) => option.kind === "builtIn");
	const reusableOptions = options.filter((option) => option.kind !== "builtIn");
	const selectedOneTimeOption =
		selected.isOneTime &&
		!options.some(
			(option) =>
				normalizeSubjectName(option.name) ===
				normalizeSubjectName(selected.name),
		)
			? {
					key: `one-time:${normalizeSubjectName(selected.name)}`,
					name: selected.name,
					isOneTime: true,
					kind: "oneTime" as const,
					Icon: getSubjectIcon(selected.name),
				}
			: null;
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
			{builtInOptions.map((option) => (
				<SubjectOptionRow
					key={option.key}
					option={option}
					selected={isSelected(option)}
					onPress={() => onSelect(selectionFor(option))}
				/>
			))}

			{selectedOneTimeOption ? (
				<>
					<Text className="pt-3 pl-1 font-poppins font-semibold text-body-4 text-secondary-text">
						Nur für diesen Eintrag
					</Text>
					<SubjectOptionRow
						option={selectedOneTimeOption}
						selected
						onPress={() => onSelect(selectionFor(selectedOneTimeOption))}
					/>
				</>
			) : null}

			{reusableOptions.length > 0 ? (
				<Text className="pt-3 pl-1 font-poppins font-semibold text-body-4 text-secondary-text">
					Persönliche Fächer
				</Text>
			) : null}
			{reusableOptions.map((option) => (
				<SubjectOptionRow
					key={option.key}
					option={option}
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
	permanentOnly = false,
}: {
	options: SubjectOption[];
	permanentOnly?: boolean;
	onCancel: () => void;
	onSelect: (selection: SubjectSelection) => void;
	onSavePermanent: (name: string) => Promise<SubjectSelection>;
}) {
	const inputRef = useRef<TextInput>(null);
	const savingRef = useRef(false);
	const [name, setName] = useState("");
	const [step, setStep] = useState<"input" | "confirm">("input");
	const [isBusy, setIsBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const cleanedName = correctSubjectName(name);
	const submitLabel = isBusy
		? "Wird gespeichert …"
		: permanentOnly
			? "Fach hinzufügen"
			: "Weiter";

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
		if (existing && (!permanentOnly || existing.kind !== "timetable")) {
			finish({
				name: existing.name,
				...(existing.personalSubjectId
					? { personalSubjectId: existing.personalSubjectId }
					: {}),
			});
			return;
		}
		if (permanentOnly) {
			void savePermanent(existing?.name ?? cleanedName);
			return;
		}
		Keyboard.dismiss();
		setName(existing?.name ?? cleanedName);
		setStep("confirm");
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
			title={
				step === "input" ? "Fach hinzufügen" : "Fach dauerhaft hinzufügen?"
			}
			description={
				step === "confirm"
					? `${cleanedName} kann künftig bei Prüfungen, Hausaufgaben, Lernplänen und im Stundenplan ausgewählt werden.`
					: permanentOnly
						? "Dein persönliches Fach wird gespeichert und steht dir bei Prüfungen, Hausaufgaben, Lernplänen und im Stundenplan zur Verfügung."
						: "Gib ein Fach ein, das noch nicht in der Liste steht."
			}
			onClose={cancel}
			onPresented={() => inputRef.current?.focus()}
			dismissible={!isBusy}
			closeAccessibilityLabel="Fach hinzufügen schließen"
			scrollable
		>
			{step === "input" ? (
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
							returnKeyType={permanentOnly ? "done" : "next"}
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
			) : (
				<View className="gap-3">
					{errorMessage ? (
						<ErrorMessage className="mb-2">{errorMessage}</ErrorMessage>
					) : null}
					<Button
						accessibilityState={{ busy: isBusy, disabled: isBusy }}
						disabled={isBusy}
						onPress={() => void savePermanent()}
					>
						{isBusy ? <ActivityIndicator color="#FFFFFF" /> : null}
						<Text>
							{isBusy ? "Wird gespeichert …" : "Dauerhaft hinzufügen"}
						</Text>
					</Button>
					{!permanentOnly ? (
						<Button
							disabled={isBusy}
							variant="outline"
							onPress={() => finish({ name: cleanedName, isOneTime: true })}
						>
							<Text>Nur diesmal verwenden</Text>
						</Button>
					) : null}
					<Button disabled={isBusy} variant="cancel" onPress={cancel}>
						<Text>Abbrechen</Text>
					</Button>
				</View>
			)}
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
	SubjectOptionRow,
	SubjectPickerContent,
	SubjectPickerSheet,
};
