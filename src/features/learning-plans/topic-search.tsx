import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { topicTitleKey } from "#convex/examTopicInput";
import { ErrorMessage } from "~/components/ui/error-message";
import { X } from "~/components/ui/icon";
import { SearchField } from "~/components/ui/search-field";
import {
	SelectionControl,
	SelectionIndicator,
} from "~/components/ui/selection-control";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";

export type TopicSearchResult = {
	topics: {
		id: string;
		title: string;
		subjects?: string[];
		isAdditional?: boolean;
	}[];
	truncated: boolean;
};
export type SearchTopics = (args: {
	query: string;
	subject: string;
}) => Promise<TopicSearchResult>;

const MAX_VISIBLE_RESULTS = 5;

/** Search selections remain distinct from the learner's additional free text. */
export function TopicSearch({
	selectedTopics,
	subject,
	onChangeSelectedTopics,
	searchTopics,
	disabled,
}: {
	selectedTopics: string[];
	subject: string;
	onChangeSelectedTopics: (value: string[]) => void;
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
	const cacheKey = JSON.stringify([subject, term]);
	const key = JSON.stringify([cacheKey, retry]);
	const canSearch = term.length >= 3 && term.length <= 100;

	useEffect(() => {
		if (!canSearch || disabled) return;
		let active = true;
		const timer = setTimeout(() => {
			const cached = cache.current.get(cacheKey);
			if (cached && cached.expires > Date.now()) {
				setState({ key, result: cached.result });
				return;
			}
			void searchTopics({ query: term, subject })
				.then((result) => {
					if (!active) return;
					if (cache.current.size >= 30) cache.current.clear();
					cache.current.set(cacheKey, {
						result,
						expires: Date.now() + 300_000,
					});
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
	}, [cacheKey, canSearch, disabled, key, searchTopics, subject, term]);

	const current = state.key === key ? state : undefined;
	const result = current?.result;
	const visible = result?.topics.slice(0, MAX_VISIBLE_RESULTS) ?? [];
	return (
		<View className="mt-6 gap-3">
			<SearchField
				accessibilityLabel="Themen suchen"
				accessibilityHint="Optional. Wähle passende Themen aus oder trage fehlende Themen unten ein."
				accessibilityState={{ disabled }}
				placeholder="Thema suchen"
				value={query}
				onChangeText={setQuery}
				editable={!disabled}
			/>
			{term.length > 100 ? (
				<Text className="font-poppins text-body-3 text-secondary-text">
					Suche nach einem kürzeren Begriff. Deine vollständige Themenliste
					kannst du unten einfügen.
				</Text>
			) : term.length > 0 && term.length < 3 ? (
				<Text className="font-poppins text-body-3 text-secondary-text">
					Gib mindestens drei Zeichen ein, um Themen zu suchen.
				</Text>
			) : canSearch && current?.error ? (
				<View className="gap-1">
					<ErrorMessage className="text-body-3">
						Die Themensuche ist gerade nicht erreichbar. Du kannst deine Themen
						unten direkt eintragen und fortfahren.
					</ErrorMessage>
					<ActionSurface
						accessibilityRole="button"
						disabled={disabled}
						onPress={() => setRetry((value) => value + 1)}
						className="min-h-12 justify-center rounded-none bg-transparent py-3"
					>
						<Text className="font-poppins text-body-3 text-text">
							Erneut versuchen
						</Text>
					</ActionSurface>
				</View>
			) : canSearch && !result && !disabled ? (
				<Text
					accessibilityLiveRegion="polite"
					className="font-poppins text-body-3 text-secondary-text"
				>
					Themen werden gesucht …
				</Text>
			) : canSearch && result ? (
				<View>
					<Text
						accessibilityLiveRegion="polite"
						className="font-poppins text-body-4 text-secondary-text"
					>
						{visible.length
							? "Wähle nur Themen aus, die bei dir drankommen."
							: "Keine passenden Vorschläge. Trage deine Themen unten direkt ein."}
					</Text>
					{visible.map((topic, index) => {
						const isIncluded = selectedTopics.some(
							(title) => topicTitleKey(title) === topicTitleKey(topic.title),
						);
						const context = topic.subjects?.join(" · ");
						return (
							<View key={topic.id}>
								{topic.isAdditional && !visible[index - 1]?.isAdditional ? (
									<Text className="mt-3 font-poppins text-body-4 text-secondary-text">
										Weitere Vorschläge
									</Text>
								) : null}
								<SelectionControl
									accessibilityRole="checkbox"
									accessibilityLabel={topic.title}
									accessibilityHint={
										context ? `Themenbereich: ${context}` : undefined
									}
									selected={isIncluded}
									disabled={disabled}
									onPress={() =>
										onChangeSelectedTopics(
											isIncluded
												? selectedTopics.filter(
														(title) =>
															topicTitleKey(title) !==
															topicTitleKey(topic.title),
													)
												: [...selectedTopics, topic.title],
										)
									}
									className="mt-2"
									contentClassName="min-h-14 flex-row items-center gap-3 rounded-2xl px-4 py-3"
								>
									<View className="flex-1 gap-1">
										<Text className="font-poppins text-body-3 text-text">
											{topic.title}
										</Text>
										{context ? (
											<Text className="font-poppins text-body-4 text-secondary-text">
												{context}
											</Text>
										) : null}
									</View>
									<SelectionIndicator checkColor={colors.onPrimary} />
								</SelectionControl>
							</View>
						);
					})}
					{result.truncated || result.topics.length > MAX_VISIBLE_RESULTS ? (
						<Text className="mt-1 font-poppins text-body-4 text-secondary-text">
							Grenze deinen Suchbegriff weiter ein, um weitere passende Themen
							zu finden.
						</Text>
					) : null}
				</View>
			) : null}
			{selectedTopics.length > 0 ? (
				<View className="mt-3 gap-2">
					<Text
						accessibilityRole="header"
						className="font-poppins font-semibold text-body-3 text-text"
					>
						Ausgewählte Themen ({selectedTopics.length})
					</Text>
					<View className="flex-row flex-wrap gap-2">
						{selectedTopics.map((title) => (
							<ActionSurface
								key={topicTitleKey(title)}
								accessibilityRole="button"
								accessibilityLabel={`${title} entfernen`}
								disabled={disabled}
								accessibilityState={{ disabled }}
								onPress={() =>
									onChangeSelectedTopics(
										selectedTopics.filter(
											(item) => topicTitleKey(item) !== topicTitleKey(title),
										),
									)
								}
								className="min-h-12 max-w-full flex-row items-center gap-2 rounded-full border border-primary bg-accent px-4 py-2"
							>
								<Text className="shrink font-poppins text-body-3 text-text">
									{title}
								</Text>
								<View
									accessible={false}
									importantForAccessibility="no-hide-descendants"
								>
									<X size={16} color={colors.text} />
								</View>
							</ActionSurface>
						))}
					</View>
				</View>
			) : null}
		</View>
	);
}
