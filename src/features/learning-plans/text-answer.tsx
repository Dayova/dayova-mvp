import { useState } from "react";
import { View } from "react-native";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

export function TextAnswer({
	value,
	onChange,
	placeholder,
	editable,
	autoFocus = false,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	editable: boolean;
	autoFocus?: boolean;
}) {
	const [focused, setFocused] = useState(false);
	return (
		<View
			className={cn(
				"mt-4 h-[180px] rounded-3xl border bg-card p-4",
				focused ? "border-primary" : "border-border",
			)}
		>
			<Textarea
				autoFocus={autoFocus && editable}
				accessibilityLabel="Antwort"
				className="min-h-28 px-0 py-0"
				editable={editable}
				value={value}
				onChangeText={onChange}
				placeholder={placeholder}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
			/>
		</View>
	);
}
