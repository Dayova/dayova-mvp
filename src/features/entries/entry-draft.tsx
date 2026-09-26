import * as Linking from "expo-linking";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
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

function isEntryStartLink(url: string) {
	try {
		const { hostname, path } = Linking.parse(url);
		return path === "entry/new" || (hostname === "entry" && path === "new");
	} catch {
		return false;
	}
}

function useDraftState() {
	// The layout can survive a second entry URL. Only that new request replaces
	// answers and the saved exam identity; step Back keeps both intact.
	const [initialParams, setInitialParams] = useState<EntryParams>({});
	const [draft, setDraft] = useState(() => initialDraft({}));
	const [initialized, setInitialized] = useState(false);
	const [incomingEntryLinks, setIncomingEntryLinks] = useState(0);
	useEffect(() => {
		const subscription = Linking.addEventListener("url", ({ url }) => {
			if (isEntryStartLink(url)) setIncomingEntryLinks((count) => count + 1);
		});
		return () => subscription.remove();
	}, []);
	const savedExamIdRef = useRef<Id<"dayEntries"> | undefined>(undefined);
	const requestKeyRef = useRef<string | undefined>(undefined);
	const requestVersionRef = useRef(0);
	const initialize = useCallback((params: EntryParams, requestKey: string) => {
		if (requestKeyRef.current === requestKey) return false;
		requestKeyRef.current = requestKey;
		requestVersionRef.current += 1;
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
		requestVersionRef,
		entryCreationGateRef,
		initialized,
		incomingEntryLinks,
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
