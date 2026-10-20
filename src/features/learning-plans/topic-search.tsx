import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { topicTitleKey } from "#convex/examTopicInput";
import {
	normalizeWloQuery,
	normalizeWloText,
	rankWloTopics,
} from "#convex/wloSubjectContext";
import { ErrorMessage } from "~/components/ui/error-message";
import { SearchField } from "~/components/ui/search-field";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import {
	SearchSelectionChip,
	SearchSelectionRow,
	SearchSuggestion,
} from "./search-selection";

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

const MAX_VISIBLE_RESULTS = 4;
const SEARCH_DELAY_MS = 120;

type CachedTopics = {
	result: TopicSearchResult;
	expires: number;
	term: string;
	subject: string;
};

function cachedSearch(
	cache: Map<string, CachedTopics>,
	term: string,
	subject: string,
) {
	const normalizedTerm = normalizeWloQuery(term);
	const normalizedSubject = normalizeWloText(subject);
	const now = Date.now();
	const exact = cache.get(JSON.stringify([normalizedSubject, normalizedTerm]));
	if (exact && exact.expires > now) return { result: exact.result };

	// Matching known titles are only a preview. Always fetch the authoritative
	// answer so a broad cached search cannot hide new, more specific matches.
	const sources = [...cache.values()]
		.filter(
			(entry) => entry.subject === normalizedSubject && entry.expires > now,
		)
		.sort((a, b) => b.expires - a.expires);
	const known = new Map<string, TopicSearchResult["topics"][number]>();
	for (const source of sources) {
		for (const topic of source.result.topics) {
			if (!known.has(topicTitleKey(topic.title)))
				known.set(topicTitleKey(topic.title), topic);
		}
	}
	const topics = rankWloTopics([...known.values()], normalizedTerm, subject);
	return topics.length
		? { result: { topics, truncated: true }, refreshing: true }
		: undefined;
}

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
	const [query, setQuery] = useState("");
	const [retry, setRetry] = useState(0);
	const [state, setState] = useState<{
		key: string;
		result?: TopicSearchResult;
		error?: boolean;
		refreshing?: boolean;
	}>({ key: "" });
	const cache = useRef(new Map<string, CachedTopics>());
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
		const cached = cachedSearch(cache.current, term, subject);
		if (cached) {
			setState({ key, ...cached });
			if (!cached.refreshing) return;
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

	function changeQuery(value: string) {
		const nextTerm = value.trim();
		const nextKey = JSON.stringify([
			JSON.stringify([normalizedSubject, normalizeWloQuery(nextTerm)]),
			retry,
		]);
		// Commit the query and its matching cached rows together. Restoring rows
		// only in the effect leaves a blank committed frame after each keystroke.
		setQuery(value);
		if (nextKey === key) return;
		setState({
			key: nextKey,
			...(nextTerm.length >= 3 && nextTerm.length <= 100
				? cachedSearch(cache.current, nextTerm, subject)
				: undefined),
		});
	}

	const current = state.key === key ? state : undefined;
	const result = current?.result;
	const titleKey = topicTitleKey(term);
	const exact = result?.topics.find(
		(topic) => topicTitleKey(topic.title) === titleKey,
	);
	// Keep the learner's chosen spelling when a catalog result arrives later.
	const selectedTitle = selectedTopics.find(
		(title) => topicTitleKey(title) === titleKey,
	);
	const directTitle = selectedTitle ?? exact?.title ?? term;
	const otherTopics =
		result?.topics.filter((topic) => topicTitleKey(topic.title) !== titleKey) ??
		[];
	const visible = otherTopics.slice(0, MAX_VISIBLE_RESULTS - (exact ? 1 : 0));
	function toggleTopic(title: string) {
		const included = selectedTopics.some(
			(item) => topicTitleKey(item) === topicTitleKey(title),
		);
		onChangeSelectedTopics(
			included
				? selectedTopics.filter(
						(item) => topicTitleKey(item) !== topicTitleKey(title),
					)
				: [...selectedTopics, title],
		);
	}
	const directChoice = term ? (
		<SearchSuggestion
			title={directTitle}
			detail={
				exact
					? exact.subjects?.join(" · ") || "Katalogvorschlag"
					: "Eigenes Thema"
			}
			hint={
				exact?.subjects?.length
					? `Themenbereich: ${exact.subjects.join(" · ")}`
					: "Dein eingegebener Begriff. Kein Katalogtreffer erforderlich."
			}
			selected={selectedTitle !== undefined}
			disabled={disabled}
			onPress={() => toggleTopic(directTitle)}
		/>
	) : null;
	return (
		<View className="mt-6 gap-3">
			<SearchField
				accessibilityLabel="Themen suchen"
				accessibilityHint="Suche nach Vorschlägen oder wähle deinen eingegebenen Begriff direkt als Thema aus."
				accessibilityState={{
					disabled,
					busy:
						!disabled &&
						canSearch &&
						!current?.error &&
						(!result || !!current?.refreshing),
				}}
				placeholder="Thema suchen oder eingeben"
				value={query}
				onChangeText={changeQuery}
				editable={!disabled}
			/>
			{selectedTopics.length > 0 ? (
				<SearchSelectionRow
					count={selectedTopics.length}
					label="Ausgewählte Themen"
				>
					{selectedTopics.map((title) => (
						<SearchSelectionChip
							key={topicTitleKey(title)}
							title={title}
							disabled={disabled}
							onRemove={() =>
								onChangeSelectedTopics(
									selectedTopics.filter(
										(item) => topicTitleKey(item) !== topicTitleKey(title),
									),
								)
							}
						/>
					))}
				</SearchSelectionRow>
			) : null}
			{term.length > 100 ? (
				<Text className="font-poppins text-body-3 text-secondary-text">
					Für Katalogvorschläge nutze höchstens 100 Zeichen. Deinen
					vollständigen Text kannst du unten als eigenes Thema übernehmen.
				</Text>
			) : term.length > 0 && term.length < 3 ? (
				<Text className="font-poppins text-body-3 text-secondary-text">
					Katalogvorschläge gibt es ab drei Zeichen. Deinen Begriff kannst du
					schon auswählen.
				</Text>
			) : canSearch && current?.error ? (
				<View className="gap-1">
					<ErrorMessage className="text-body-3">
						Die Katalogsuche ist gerade nicht erreichbar. Du kannst deinen
						Begriff unten trotzdem als Thema auswählen.
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
			<View className="gap-2">
				{exact ? directChoice : null}
				{canSearch && result ? (
					<>
						{!current?.refreshing &&
						!current?.error &&
						!exact &&
						visible.length === 0 ? (
							<Text
								accessibilityLiveRegion="polite"
								className="font-poppins text-body-4 text-secondary-text"
							>
								{selectedTitle !== undefined
									? "Keine weiteren Katalogvorschläge."
									: "Keine passenden Katalogvorschläge. Du kannst deinen Begriff unten übernehmen."}
							</Text>
						) : null}
						{visible.map((topic) => {
							const isIncluded = selectedTopics.some(
								(title) => topicTitleKey(title) === topicTitleKey(topic.title),
							);
							const context = topic.subjects?.join(" · ");
							return (
								<SearchSuggestion
									key={topic.id}
									title={topic.title}
									detail={context}
									hint={context ? `Themenbereich: ${context}` : undefined}
									selected={isIncluded}
									disabled={disabled}
									onPress={() => toggleTopic(topic.title)}
								/>
							);
						})}
					</>
				) : null}
				{!exact ? directChoice : null}
			</View>
		</View>
	);
}
