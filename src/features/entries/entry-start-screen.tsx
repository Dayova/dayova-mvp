import { useLocalSearchParams } from "expo-router";
import {
	CommonActions,
	useIsFocused,
	useNavigation,
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
	const isFocused = useIsFocused();
	const { draft, initialized, initialize } = useEntryDraft();
	const params = useLocalSearchParams<EntrySearchParams>();
	const pendingHistoryRestore = useRef(false);
	useLayoutEffect(() => {
		if (initialized) return;
		const entry = resolveEntryStartParams(params);
		if (!initialize(entry.params)) return;
		pendingHistoryRestore.current = entry.restoreExamHistory;
	}, [params, initialized, initialize]);
	useLayoutEffect(() => {
		if (!initialized || !isFocused || !pendingHistoryRestore.current) return;
		pendingHistoryRestore.current = false;
		// A cold link can mount this leaf before its native navigator has settled.
		// Restore history after initialization and focus, not during initialization.
		navigation.dispatch(
			CommonActions.reset({
				index: EXAM_RESUME_ROUTES.length - 1,
				routes: EXAM_RESUME_ROUTES.map((name) => ({ name })),
			}),
		);
	}, [initialized, isFocused, navigation]);
	if (!initialized) return null;
	return (
		<EntryStepScreen step={draft.type === "homework" ? "basics" : "examType"} />
	);
}
