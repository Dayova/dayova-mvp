import { useState } from "react";
import { View } from "react-native";
import { Button } from "~/components/ui/button";
import { Plus } from "~/components/ui/icon";
import { SearchField } from "~/components/ui/search-field";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { useDayovaTheme } from "~/lib/theme";
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
	const { colors } = useDayovaTheme();
	const [query, setQuery] = useState("");
	const term = query.trim();
	const examples = getExamHintExamples(subject, selectedTopics).filter(
		(example) =>
			example
				.toLocaleLowerCase("de-DE")
				.includes(term.toLocaleLowerCase("de-DE")),
	);
	const add = (hint: string) => {
		if (disabled) return;
		onChange(appendExamHint(value, hint));
		setQuery("");
	};
	return (
		<View className="gap-3">
			<Text className="font-poppins text-body-3 text-secondary-text">
				Ergänze nur, was für deine Prüfung gilt. Beispiele sind keine Vorgaben.
				Du kannst auch eigene Hinweise formulieren.
			</Text>
			<SearchField
				accessibilityLabel="Hinweise suchen"
				placeholder="Hinweis suchen oder eingeben"
				value={query}
				onChangeText={setQuery}
				editable={!disabled}
				accessibilityState={{ disabled }}
			/>

			{examples.map((example) => (
				<ActionSurface
					accessibilityRole="button"
					accessibilityState={{ disabled }}
					key={example}
					disabled={disabled}
					accessibilityLabel={`Beispiel übernehmen: ${example}`}
					onPress={() => add(example)}
					className="min-h-14 flex-row items-center gap-3 rounded-none bg-transparent py-3"
				>
					<Text className="flex-1 font-poppins font-semibold text-body-2 text-text">
						{example}
					</Text>
					<View
						accessible={false}
						importantForAccessibility="no-hide-descendants"
						className="h-8 w-8 items-center justify-center rounded-full border border-secondary-text"
					>
						<Plus size={20} color={colors.secondaryText} />
					</View>
				</ActionSurface>
			))}
			{term &&
			!examples.some(
				(example) =>
					example.toLocaleLowerCase("de-DE") ===
					term.toLocaleLowerCase("de-DE"),
			) ? (
				<Button
					variant="cancel"
					size="sm"
					disabled={disabled}
					onPress={() => add(term)}
					accessibilityLabel={`Eigenen Hinweis hinzufügen: ${term}`}
				>
					<Text>„{term}“ als eigenen Hinweis hinzufügen</Text>
				</Button>
			) : null}
			<Text className="font-poppins text-body-4 text-secondary-text">
				Deine Hinweise – jederzeit bearbeitbar
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
		</View>
	);
}
