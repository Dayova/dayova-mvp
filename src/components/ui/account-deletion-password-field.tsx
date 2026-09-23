import { DayovaSheetInput } from "~/components/ui/dayova-sheet-frame";
import { Field, FieldControl, FieldLabel } from "~/components/ui/field";

export function AccountDeletionPasswordField({
	value,
	onChangeText,
	disabled,
}: {
	value: string;
	onChangeText: (value: string) => void;
	disabled: boolean;
}) {
	const label = "Aktuelles Passwort zur Bestätigung";
	return (
		<Field>
			<FieldLabel>{label}</FieldLabel>
			<FieldControl>
				<DayovaSheetInput
					accessibilityLabel={label}
					value={value}
					onChangeText={onChangeText}
					secureTextEntry
					autoCapitalize="none"
					autoCorrect={false}
					autoComplete="current-password"
					textContentType="password"
					editable={!disabled}
				/>
			</FieldControl>
		</Field>
	);
}
