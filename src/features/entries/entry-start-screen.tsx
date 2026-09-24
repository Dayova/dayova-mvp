import { useLocalSearchParams } from "expo-router";
import { CommonActions, useNavigation } from "expo-router/react-navigation";
import { useLayoutEffect } from "react";
import { useEntryDraft } from "./entry-draft";
import {
	type EntrySearchParams,
	EXAM_RESUME_ROUTES,
	resolveEntryStartParams,
} from "./entry-routes";
import { EntryStepScreen } from "./entry-step-screen";

export function EntryStartScreen() {
	const navigation = useNavigation();
	const { draft, initialized, initialize } = useEntryDraft();
	const params = useLocalSearchParams<EntrySearchParams>();
	useLayoutEffect(() => {
		if (initialized) return;
		const entry = resolveEntryStartParams(params);
		if (!initialize(entry.params)) return;
		if (entry.restoreExamHistory) {
			// Old resume URLs still enter here. Rebuild real predecessors once,
			// so Back from a resumed exam visits Date, Subject, then Exam type.
			navigation.dispatch(
				CommonActions.reset({
					index: EXAM_RESUME_ROUTES.length - 1,
					routes: EXAM_RESUME_ROUTES.map((name) => ({ name })),
				}),
			);
		}
	}, [params, initialized, initialize, navigation]);
	if (!initialized) return null;
	return (
		<EntryStepScreen step={draft.type === "homework" ? "basics" : "examType"} />
	);
}
