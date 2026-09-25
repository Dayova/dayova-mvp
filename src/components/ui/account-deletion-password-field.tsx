import { useRef } from "react";
import type { TextInput } from "react-native";
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
	const inputRef = useRef<TextInput>(null);
	return (
		<Field>
			<FieldLabel onPress={() => inputRef.current?.focus()}>{label}</FieldLabel>
			<FieldControl>
				<DayovaSheetInput
					ref={inputRef}
					className="min-h-16 self-stretch"
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
