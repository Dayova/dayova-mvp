import { useLocalSearchParams } from "expo-router";
import {
	CommonActions,
	useIsFocused,
	useNavigation,
	useRoute,
} from "expo-router/react-navigation";
import { useLayoutEffect, useRef } from "react";
import { useEntryDraft } from "./entry-draft";
import {
	type EntrySearchParams,
	EXAM_RESUME_ROUTES,
	resolveEntryStartParams,
} from "./entry-routes";
import { EntryStepScreen } from "./entry-step-screen";

export function EntryStartScreen() {
	const navigation = useNavigation();
	const route = useRoute();
	const isFocused = useIsFocused();
	const { draft, initialized, initialize } = useEntryDraft();
	const params = useLocalSearchParams<EntrySearchParams>();
	const pendingHistoryRestore = useRef<"fresh" | "resume" | null>(null);
	const requestKey = JSON.stringify([
		route.key,
		params.type,
		params.dayKey,
		params.step,
		params.subject,
		params.examTypeLabel,
		params.examDayEntryId,
		params.durationMinutes,
		params.topicDescription,
	]);
	useLayoutEffect(() => {
		if (!isFocused) return;
		const entry = resolveEntryStartParams(params);
		if (!initialize(entry.params, requestKey)) return;
		pendingHistoryRestore.current = entry.restoreExamHistory
			? "resume"
			: initialized
				? "fresh"
				: null;
	}, [params, requestKey, initialized, isFocused, initialize]);
	useLayoutEffect(() => {
		const history = pendingHistoryRestore.current;
		if (!initialized || !isFocused || !history) return;
		pendingHistoryRestore.current = null;
		// A cold link can mount this leaf before its native navigator has settled.
		// Restore history after initialization and focus, not during initialization.
		const routes = history === "resume" ? EXAM_RESUME_ROUTES : ["index"];
		navigation.dispatch(
			CommonActions.reset({
				index: routes.length - 1,
				routes: routes.map((name) =>
					name === "index" ? { name, key: route.key, params } : { name },
				),
			}),
		);
	}, [initialized, isFocused, navigation, route.key, params]);
	if (!initialized) return null;
	return (
		<EntryStepScreen step={draft.type === "homework" ? "basics" : "examType"} />
	);
}
