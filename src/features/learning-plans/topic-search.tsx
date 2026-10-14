import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { isMeaningfulTopicDescription } from "#convex/topicDescriptionValidation";
import { Check, Plus, X } from "~/components/ui/icon";
import { SearchField } from "~/components/ui/search-field";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";

export type TopicSearchResult = {
	topics: { id: string; title: string }[];
	truncated: boolean;
};
export type SearchTopics = (args: {
	query: string;
	subject: string;
}) => Promise<TopicSearchResult>;
const keyOf = (text: string) => text.trim().toLocaleLowerCase("de-DE");

export function TopicSearch({
	topics,
	subject,
	onChangeTopics,
	searchTopics,
	disabled,
}: {
	topics: string;
	subject: string;
	onChangeTopics: (value: string) => void;
	searchTopics: SearchTopics;
	disabled: boolean;
}) {
	const { colors } = useDayovaTheme();
	const [query, setQuery] = useState("");
	const [retry, setRetry] = useState(0);
	const [state, setState] = useState<{
		key: string;
		result?: TopicSearchResult;
		error?: boolean;
	}>({ key: "" });
	const cache = useRef(
		new Map<string, { result: TopicSearchResult; expires: number }>(),
	);
	const term = query.trim();
	const key = JSON.stringify([subject, term, retry]);
	// New selections are newline-separated; legacy free text remains one intact item.
	const selected = [
		...new Set(
			topics
				.split("\n")
				.map((value) => value.trim())
				.filter(Boolean),
		),
	];
	const canAdd =
		isMeaningfulTopicDescription(term) &&
		!selected.some((value) => keyOf(value) === keyOf(term));
	useEffect(() => {
		if (term.length < 3 || disabled) return;
		let active = true;
		const timer = setTimeout(() => {
			const cached = cache.current.get(key);
			if (cached && cached.expires > Date.now()) {
				setState({ key, result: cached.result });
				return;
			}
			void searchTopics({ query: term, subject })
				.then((result) => {
					if (!active) return;
					if (cache.current.size >= 30) cache.current.clear();
					cache.current.set(key, { result, expires: Date.now() + 300_000 });
					setState({ key, result });
				})
				.catch(() => {
					if (active) setState({ key, error: true });
				});
		}, 350);
		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [key, term, subject, searchTopics, disabled]);
	const current = state.key === key ? state : undefined;
	const add = (title: string) => {
		if (!selected.some((value) => keyOf(value) === keyOf(title)))
			onChangeTopics([...selected, title].join("\n"));
		setQuery("");
	};
	return (
		<View className="mt-6 gap-4">
			<SearchField
				accessibilityLabel="Thema suchen"
				placeholder={`Thema in ${subject} suchen`}
				value={query}
				onChangeText={setQuery}
				editable={!disabled}
				maxLength={100}
				autoCorrect={false}
				returnKeyType="search"
			/>
			{selected.length > 0 ? (
				<View className="gap-2">
					<View className="flex-row flex-wrap gap-2">
						{selected.map((title, index) => (
							<ActionSurface
								key={title}
								accessibilityRole="button"
								accessibilityLabel={`${title} entfernen`}
								disabled={disabled}
								onPress={() =>
									onChangeTopics(
										selected.filter((_, i) => i !== index).join("\n"),
									)
								}
								className="min-h-12 max-w-full flex-row items-center gap-2 rounded-full border border-border px-4 py-3"
							>
								<Text className="shrink font-poppins text-body-3 text-text">
									{title}
								</Text>
								<X size={18} color={colors.secondaryText} />
							</ActionSurface>
						))}
					</View>
				</View>
			) : null}
			{term.length < 3 ? null : current?.error ? (
				<View className="gap-2">
					<Text
						accessibilityRole="alert"
						className="font-poppins text-body-3 text-secondary-text"
					>
						Die Themensuche ist gerade nicht erreichbar. Du kannst dein Thema
						selbst hinzufügen.
					</Text>
					<ActionSurface
						accessibilityRole="button"
						disabled={disabled}
						onPress={() => {
							setState({ key: "" });
							setRetry((value) => value + 1);
						}}
						className="min-h-12 justify-center px-4 py-3"
					>
						<Text className="font-poppins text-body-3 text-text">
							Erneut versuchen
						</Text>
					</ActionSurface>
				</View>
			) : !current?.result ? (
				<Text
					accessibilityLiveRegion="polite"
					className="font-poppins text-body-3 text-secondary-text"
				>
					Themen werden gesucht …
				</Text>
			) : (
				<View className="gap-2">
					{current.result.topics.length === 0 ? (
						<Text
							accessibilityLiveRegion="polite"
							className="font-poppins text-body-3 text-secondary-text"
						>
							Keine passenden Themen gefunden. Versuche einen anderen Begriff
							oder füge dein Thema selbst hinzu.
						</Text>
					) : (
						<>
							<Text className="font-poppins text-body-4 text-secondary-text">
								Vorschläge von WirLernenOnline
							</Text>
							{current.result.topics.map((topic) => {
								const isSelected = selected.some(
									(value) => keyOf(value) === keyOf(topic.title),
								);
								return (
									<ActionSurface
										key={topic.id}
										accessibilityRole="button"
										accessibilityLabel={
											isSelected
												? `${topic.title}, hinzugefügt`
												: `${topic.title} hinzufügen`
										}
										accessibilityState={{
											disabled: disabled || isSelected,
											selected: isSelected,
										}}
										disabled={disabled || isSelected}
										onPress={() => add(topic.title)}
										className="min-h-16 flex-row items-center gap-4 rounded-none bg-transparent px-1 py-4"
									>
										<Text className="flex-1 font-poppins font-semibold text-body-2 text-text">
											{topic.title}
										</Text>
										<View
											accessible={false}
											className="h-8 w-8 items-center justify-center rounded-full border border-secondary-text"
										>
											{isSelected ? (
												<Check size={20} color={colors.secondaryText} />
											) : (
												<Plus size={20} color={colors.secondaryText} />
											)}
										</View>
									</ActionSurface>
								);
							})}
						</>
					)}
					{current.result.truncated ? (
						<Text className="font-poppins text-body-4 text-secondary-text">
							Grenze deinen Suchbegriff weiter ein, um weitere passende Themen
							zu finden.
						</Text>
					) : null}
				</View>
			)}
			{canAdd ? (
				<ActionSurface
					accessibilityRole="button"
					accessibilityLabel={`Eigenes Thema hinzufügen: ${term}`}
					disabled={disabled}
					onPress={() => add(term)}
					className="min-h-12 justify-center px-4 py-3"
				>
					<Text className="font-poppins text-body-3 text-text">
						„{term}“ als eigenes Thema hinzufügen
					</Text>
				</ActionSurface>
			) : null}
		</View>
	);
}
