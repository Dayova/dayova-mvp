import { useConvexAuth, useMutation, useQueries } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect } from "react";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import {
	BUILT_IN_SUBJECT_OPTIONS,
	getSubjectIcon,
	type PersonalSubjectIcon,
} from "~/features/subjects/subject-catalog";
import { normalizeSubjectName } from "~/features/subjects/subject-definitions";
import { logDiagnosticError } from "~/lib/diagnostics";

type SubjectSelection = {
	name: string;
	personalSubjectId?: Id<"personalSubjects">;
	isOneTime?: boolean;
};

type SubjectOption = SubjectSelection & {
	key: string;
	kind: "builtIn" | "personal" | "timetable";
	Icon: typeof PersonalSubjectIcon;
};

function useSubjectOptions() {
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
	// Unlike useQuery, useQueries returns query errors instead of throwing during
	// render. A subject-list outage must not unmount the learner's creation form.
	const results = useQueries(
		isAuthenticated
			? { subjects: { query: api.personalSubjects.list, args: {} } }
			: {},
	);
	const response = results.subjects as
		| FunctionReturnType<typeof api.personalSubjects.list>
		| Error
		| undefined;
	const queryError =
		isAuthenticated && response instanceof Error ? response : null;
	const result =
		isAuthenticated && !(response instanceof Error) ? response : undefined;
	useEffect(() => {
		if (queryError) {
			logDiagnosticError("Personal subject query failed", queryError, {
				source: "personal-subjects.list",
			});
		}
	}, [queryError]);
	const createPersonalSubject = useMutation(api.personalSubjects.create);

	const personalOptions: SubjectOption[] = (result?.personal ?? []).map(
		(subject) => ({
			key: `personal:${subject.id}`,
			name: subject.name,
			personalSubjectId: subject.id,
			kind: "personal",
			Icon: getSubjectIcon(subject.name),
		}),
	);
	const timetableOptions: SubjectOption[] = (
		result?.reusableTimetableSubjects ?? []
	).map((name) => ({
		key: `timetable:${normalizeSubjectName(name)}`,
		name,
		kind: "timetable",
		Icon: getSubjectIcon(name),
	}));
	const options: SubjectOption[] = [
		...BUILT_IN_SUBJECT_OPTIONS,
		...personalOptions,
		...timetableOptions,
	];

	const savePermanent = async (name: string): Promise<SubjectSelection> => {
		const result = await createPersonalSubject({ name });
		return result.kind === "personal"
			? { name: result.name, personalSubjectId: result.id }
			: { name: result.name };
	};

	return {
		isLoading: isAuthLoading || (isAuthenticated && response === undefined),
		loadError: queryError
			? "Deine persönlichen Fächer konnten nicht geladen werden. Bitte öffne die Fachauswahl später erneut."
			: null,
		options,
		personalOptions,
		savePermanent,
	};
}

export type { SubjectOption, SubjectSelection };
export { useSubjectOptions };
