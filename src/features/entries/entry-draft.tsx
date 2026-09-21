import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useRef,
	useState,
} from "react";
import type { Id } from "#convex/_generated/dataModel";
import { createAsyncActionGate } from "~/lib/async-action-gate";
import { parseDayKey, startOfLocalDay } from "~/lib/day-key";
import {
	MAX_EXAM_DURATION_MINUTES,
	MIN_EXAM_DURATION_MINUTES,
} from "~/lib/entry-time";
import type { EntryParams } from "./entry-routes";

type EntryDraft = {
	type: "exam" | "homework";
	subject: string;
	examTypeLabel: string;
	note: string;
	dueDate: Date;
	plannedDate: Date;
	plannedTime: Date;
	plannedEndTime: Date;
};

function initialDraft(params: EntryParams): EntryDraft {
	const date = parseDayKey(params.dayKey) ?? startOfLocalDay(new Date());
	const plannedTime = new Date();
	plannedTime.setHours(16, 0, 0, 0);
	const plannedEndTime = new Date(plannedTime);
	const duration =
		params.type === "exam" && Number.isFinite(Number(params.durationMinutes))
			? Math.min(
					MAX_EXAM_DURATION_MINUTES,
					Math.max(MIN_EXAM_DURATION_MINUTES, Number(params.durationMinutes)),
				)
			: 30;
	plannedEndTime.setMinutes(duration);
	return {
		type: params.type === "exam" ? "exam" : "homework",
		subject: params.subject ?? "",
		examTypeLabel: params.examTypeLabel ?? "",
		note: "",
		dueDate: date,
		plannedDate: date,
		plannedTime,
		plannedEndTime,
	};
}

function useDraftState() {
	// This layout lives for one entry flow, including trips to learning-time settings.
	// Screen unmounts never own or discard the answers or the saved exam identity.
	const [initialParams, setInitialParams] = useState<EntryParams>({});
	const [draft, setDraft] = useState(() => initialDraft({}));
	const [initialized, setInitialized] = useState(false);
	const savedExamIdRef = useRef<Id<"dayEntries"> | undefined>(undefined);
	const initializedRef = useRef(false);
	const initialize = useCallback((params: EntryParams) => {
		if (initializedRef.current) return false;
		initializedRef.current = true;
		savedExamIdRef.current =
			params.type === "exam"
				? (params.examDayEntryId as Id<"dayEntries"> | undefined)
				: undefined;
		setInitialParams(params);
		setDraft(initialDraft(params));
		setInitialized(true);
		return true;
	}, []);
	const updateDraft = useCallback((patch: Partial<EntryDraft>) => {
		setDraft((current) => ({ ...current, ...patch }));
	}, []);
	const entryCreationGateRef = useRef(createAsyncActionGate());
	return {
		draft,
		updateDraft,
		initialParams,
		savedExamIdRef,
		entryCreationGateRef,
		initialized,
		initialize,
	};
}

const EntryDraftContext = createContext<ReturnType<
	typeof useDraftState
> | null>(null);

export function EntryDraftProvider({ children }: { children: ReactNode }) {
	const value = useDraftState();
	return (
		<EntryDraftContext.Provider value={value}>
			{children}
		</EntryDraftContext.Provider>
	);
}

export function useEntryDraft() {
	const context = useContext(EntryDraftContext);
	if (!context) throw new Error("Entry steps require an EntryDraftProvider");
	return context;
}
