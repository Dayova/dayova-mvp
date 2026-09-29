import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import {
	BUILT_IN_SUBJECT_OPTIONS,
	PersonalSubjectIcon,
} from "~/features/subjects/subject-catalog";
import { normalizeSubjectName } from "~/features/subjects/subject-definitions";

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
	const { isAuthenticated } = useConvexAuth();
	const result = useQuery(
		api.personalSubjects.list,
		isAuthenticated ? {} : "skip",
	);
	const createPersonalSubject = useMutation(api.personalSubjects.create);

	const personalOptions: SubjectOption[] = (result?.personal ?? []).map(
		(subject) => ({
			key: `personal:${subject.id}`,
			name: subject.name,
			personalSubjectId: subject.id,
			kind: "personal",
			Icon: PersonalSubjectIcon,
		}),
	);
	const timetableOptions: SubjectOption[] = (
		result?.reusableTimetableSubjects ?? []
	).map((name) => ({
		key: `timetable:${normalizeSubjectName(name)}`,
		name,
		kind: "timetable",
		Icon: PersonalSubjectIcon,
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
		isLoading: isAuthenticated && result === undefined,
		options,
		personalOptions,
		savePermanent,
	};
}

export type { SubjectOption, SubjectSelection };
export { useSubjectOptions };
