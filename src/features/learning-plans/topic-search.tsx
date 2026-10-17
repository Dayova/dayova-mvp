import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { topicTitleKey } from "#convex/examTopicInput";
import {
	normalizeWloQuery,
	normalizeWloText,
	rankWloTopics,
} from "#convex/wloSubjectContext";
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
const SEARCH_DELAY_MS = 120;

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
		refreshing?: boolean;
	}>({ key: "" });
	const cache = useRef(
		new Map<
			string,
			{
				result: TopicSearchResult;
				expires: number;
				term: string;
				subject: string;
			}
		>(),
	);
	const pending = useRef(new Map<string, Promise<TopicSearchResult>>());
	const term = query.trim();
	const normalizedTerm = normalizeWloQuery(term);
	const normalizedSubject = normalizeWloText(subject);
	const cacheKey = JSON.stringify([normalizedSubject, normalizedTerm]);
	const key = JSON.stringify([cacheKey, retry]);
	const canSearch = term.length >= 3 && term.length <= 100;

	useEffect(() => {
		if (!canSearch || disabled) return;
		let active = true;
		const cached = cache.current.get(cacheKey);
		if (cached && cached.expires > Date.now()) {
			setState({ key, result: cached.result });
			return;
		}
		// Show only already known titles that actually match the new term. This
		// is a preview, never a final cached answer: always refresh from the server
		// so truncated broad searches cannot hide more relevant narrow matches.
		const sources = [...cache.current.values()]
			.filter(
				(entry) =>
					entry.subject === normalizedSubject && entry.expires > Date.now(),
			)
			.sort((a, b) => b.expires - a.expires);
		if (sources.length) {
			const known = new Map<string, TopicSearchResult["topics"][number]>();
			for (const source of sources) {
				for (const topic of source.result.topics) {
					if (!known.has(topicTitleKey(topic.title)))
						known.set(topicTitleKey(topic.title), topic);
				}
			}
			const topics = rankWloTopics(
				[...known.values()],
				normalizedTerm,
				subject,
			);
			if (topics.length)
				setState({
					key,
					result: { topics, truncated: true },
					refreshing: true,
				});
		}
		const load = () => {
			let request = pending.current.get(cacheKey);
			if (!request) {
				request = searchTopics({ query: term, subject })
					.then((result) => {
						if (cache.current.size >= 30) {
							const oldest = cache.current.keys().next().value;
							if (oldest !== undefined) cache.current.delete(oldest);
						}
						cache.current.set(cacheKey, {
							result,
							expires: Date.now() + 300_000,
							term: normalizedTerm,
							subject: normalizedSubject,
						});
						return result;
					})
					.finally(() => pending.current.delete(cacheKey));
				pending.current.set(cacheKey, request);
			}
			void request
				.then((result) => {
					if (!active) return;
					setState({ key, result });
				})
				.catch(() => {
					if (active)
						setState((previous) => ({
							...(previous.key === key ? previous : {}),
							key,
							error: true,
							refreshing: false,
						}));
				});
		};
		// Returning to an already running request should not pay another debounce.
		const timer = pending.current.has(cacheKey)
			? undefined
			: setTimeout(load, SEARCH_DELAY_MS);
		if (timer === undefined) load();
		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [
		cacheKey,
		canSearch,
		disabled,
		key,
		normalizedSubject,
		normalizedTerm,
		searchTopics,
		subject,
		term,
	]);

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
			) : null}
			{canSearch && result ? (
				<View>
					{current?.refreshing ? (
						<Text
							accessibilityLiveRegion="polite"
							className="font-poppins text-body-4 text-secondary-text"
						>
							Themen werden gesucht …
						</Text>
					) : null}
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
