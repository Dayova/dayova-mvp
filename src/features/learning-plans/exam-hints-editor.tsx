import { View } from "react-native";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { appendExamHint, getExamHintExamples } from "./exam-hint-examples";

export function ExamHintsEditor({
	subject,
	selectedTopics,
	value,
	onChange,
	disabled = false,
}: {
	subject: string;
	selectedTopics: string[];
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
}) {
	const examples = getExamHintExamples(subject, selectedTopics);
	const add = (hint: string) => {
		if (disabled) return;
		onChange(appendExamHint(value, hint));
	};
	return (
		<View className="gap-3">
			<Text className="font-poppins text-body-3 text-secondary-text">
				Ergänze nur, was für deine Prüfung gilt. Beispiele sind keine Vorgaben.
				Du kannst auch eigene Hinweise formulieren.
			</Text>
			<Textarea
				accessibilityLabel="Hinweise zur Prüfung (optional)"
				accessibilityHint="Optional. Prüfungsbedingungen und Anweisungen bleiben vollständig bearbeitbar."
				accessibilityState={{ disabled }}
				className="min-h-32 flex-none rounded-[24px] border border-border bg-card px-4 py-4"
				value={value}
				onChangeText={onChange}
				editable={!disabled}
				placeholder="Hinweis formulieren oder Beispiel übernehmen"
			/>
			{examples.map((example) => (
				<Button
					key={example}
					variant="cancel"
					size="sm"
					disabled={disabled}
					accessibilityLabel={`Beispiel übernehmen: ${example}`}
					onPress={() => add(example)}
					className="justify-start"
				>
					<Text className="shrink font-poppins text-body-3">{example}</Text>
				</Button>
			))}
		</View>
	);
}
