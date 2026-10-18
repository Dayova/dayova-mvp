import { useState } from "react";
import { View } from "react-native";
import { Button } from "~/components/ui/button";
import { SearchField } from "~/components/ui/search-field";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { appendExamHint, getExamHintExamples } from "./exam-hint-examples";
import {
	SearchSelectionChip,
	SearchSelectionRow,
	SearchSuggestion,
} from "./search-selection";

const hintKey = (value: string) =>
	value
		.normalize("NFKC")
		.trim()
		.toLocaleLowerCase("de-DE")
		.replace(/\s+/g, " ");

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
	const [query, setQuery] = useState("");
	const [editing, setEditing] = useState(false);
	const term = query.trim();
	// Line boundaries are already used by appendExamHint. Never split conditions
	// at commas or reinterpret legacy prose, and retain untouched whitespace.
	const lines = value.split("\n");
	const selections = lines
		.map((text, index) => ({ text, index }))
		.filter((item) => item.text.trim());
	const examples = getExamHintExamples(subject, selectedTopics).filter(
		(example) => hintKey(example).includes(hintKey(term)),
	);
	const remove = (index: number) => {
		if (!disabled) onChange(lines.filter((_, i) => i !== index).join("\n"));
	};
	const add = (hint: string) => {
		if (disabled) return;
		onChange(appendExamHint(value, hint));
		setQuery("");
	};
	const selected = (hint: string) =>
		selections.find((item) => hintKey(item.text) === hintKey(hint));
	return (
		<View className="mt-6 gap-3">
			<SearchField
				accessibilityLabel="Hinweise suchen"
				placeholder="Hinweis suchen oder eingeben"
				value={query}
				onChangeText={setQuery}
				editable={!disabled}
				accessibilityState={{ disabled }}
			/>
			{selections.length > 0 ? (
				<SearchSelectionRow
					count={selections.length}
					label="Ausgewählte Hinweise"
				>
					{selections.map((item) => (
						<SearchSelectionChip
							key={`${item.index}:${item.text}`}
							title={item.text}
							disabled={disabled}
							onRemove={() => remove(item.index)}
						/>
					))}
				</SearchSelectionRow>
			) : null}
			{examples.length > 0 ? (
				<View className="mt-1 gap-2">
					{examples.map((example) => {
						const selection = selected(example);
						return (
							<SearchSuggestion
								key={example}
								title={example}
								selected={Boolean(selection)}
								disabled={disabled}
								onPress={() =>
									selection ? remove(selection.index) : add(example)
								}
							/>
						);
					})}
				</View>
			) : null}
			{term &&
			!examples.some((example) => hintKey(example) === hintKey(term)) ? (
				<SearchSuggestion
					title={term}
					custom
					customLabel={
						selected(term)
							? `„${term}“ ausgewählt`
							: `„${term}“ als eigenen Hinweis hinzufügen`
					}
					selected={Boolean(selected(term))}
					disabled={disabled}
					onPress={() => {
						const selection = selected(term);
						if (selection) remove(selection.index);
						else add(term);
					}}
				/>
			) : null}
			{editing ? (
				<View className="gap-3">
					<Textarea
						accessibilityLabel="Hinweise zur Prüfung (optional)"
						accessibilityHint="Der vollständige Hinweistext bleibt frei bearbeitbar."
						accessibilityState={{ disabled }}
						value={value}
						onChangeText={onChange}
						editable={!disabled}
						className="min-h-32 flex-none rounded-[24px] border border-border bg-card px-4 py-4"
					/>
					<Button
						variant="cancel"
						disabled={disabled}
						onPress={() => setEditing(false)}
					>
						<Text>Bearbeitung fertig</Text>
					</Button>
				</View>
			) : value.trim() ? (
				<ActionSurface
					accessibilityRole="button"
					accessibilityLabel="Hinweise bearbeiten"
					disabled={disabled}
					accessibilityState={{ disabled }}
					onPress={() => setEditing(true)}
					className="min-h-12 justify-center self-start py-3"
				>
					<Text className="font-poppins text-body-4 text-secondary-text">
						Hinweise bearbeiten
					</Text>
				</ActionSurface>
			) : null}
		</View>
	);
}
