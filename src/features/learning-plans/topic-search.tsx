import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { ErrorMessage } from "~/components/ui/error-message";
import { Check, Plus } from "~/components/ui/icon";
import { SearchField } from "~/components/ui/search-field";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";
import {
	appendTopicSuggestion,
	includesTopicSuggestion,
} from "./topic-suggestions";

export type TopicSearchResult = {
	topics: { id: string; title: string }[];
	truncated: boolean;
};
export type SearchTopics = (args: {
	query: string;
	subject: string;
}) => Promise<TopicSearchResult>;

const MAX_VISIBLE_RESULTS = 5;

/** Optional inline search; the separate free-text editor remains authoritative. */
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
				accessibilityHint="Optional. Gewählte Vorschläge werden deiner Themenliste hinzugefügt."
				accessibilityState={{ disabled }}
				placeholder={`Thema in ${subject} suchen`}
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
							? "Passende Begriffe – ergänze nur, was bei dir drankommt."
							: "Keine passenden Vorschläge. Trage deine Themen unten direkt ein."}
					</Text>
					{visible.map((topic) => {
						const isIncluded = includesTopicSuggestion(topics, topic.title);
						return (
							<ActionSurface
								key={topic.id}
								accessibilityRole="button"
								accessibilityLabel={
									isIncluded
										? `${topic.title}, bereits in deiner Themenliste`
										: `${topic.title} zur Themenliste hinzufügen`
								}
								accessibilityState={{
									disabled: disabled || isIncluded,
									selected: isIncluded,
								}}
								disabled={disabled || isIncluded}
								onPress={() =>
									onChangeTopics(appendTopicSuggestion(topics, topic.title))
								}
								className="min-h-14 flex-row items-center gap-3 rounded-none bg-transparent py-3"
							>
								<Text className="flex-1 font-poppins text-body-3 text-text">
									{topic.title}
								</Text>
								<View
									accessible={false}
									importantForAccessibility="no-hide-descendants"
								>
									{isIncluded ? (
										<Check size={20} color={colors.secondaryText} />
									) : (
										<Plus size={20} color={colors.secondaryText} />
									)}
								</View>
							</ActionSurface>
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
		</View>
	);
}
