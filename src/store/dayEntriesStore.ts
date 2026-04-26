export type DayEntry = {
  id: string;
  title: string;
  time?: string;
  kind?: string;
  notes?: string;
  dueDateKey?: string;
  dueDateLabel?: string;
  plannedDateLabel?: string;
  durationMinutes?: number;
  examTypeLabel?: string;
};

type StoredDayEntry = DayEntry & {
  dayKey: string;
};

const entriesByDay: Record<string, StoredDayEntry[]> = {};

type AddDayEntryInput = {
  dayKey: string;
  title: string;
  time?: string;
  kind?: string;
  notes?: string;
  dueDateKey?: string;
  dueDateLabel?: string;
  plannedDateLabel?: string;
  durationMinutes?: number;
  examTypeLabel?: string;
};

const toPublicEntry = ({
  id,
  title,
  time,
  kind,
  notes,
  dueDateKey,
  dueDateLabel,
  plannedDateLabel,
  durationMinutes,
  examTypeLabel,
}: StoredDayEntry): DayEntry => ({
  id,
  title,
  time,
  kind,
  notes,
  dueDateKey,
  dueDateLabel,
  plannedDateLabel,
  durationMinutes,
  examTypeLabel,
});

/**
 * Adds a new day entry to the in-memory store.
 */
export const addDayEntry = (input: AddDayEntryInput): DayEntry => {
  const entry: StoredDayEntry = {
    id: `${input.dayKey}-${Date.now()}`,
    dayKey: input.dayKey,
    title: input.title,
    time: input.time,
    kind: input.kind,
    notes: input.notes,
    dueDateKey: input.dueDateKey,
    dueDateLabel: input.dueDateLabel,
    plannedDateLabel: input.plannedDateLabel,
    durationMinutes: input.durationMinutes,
    examTypeLabel: input.examTypeLabel,
  };

  const current = entriesByDay[input.dayKey] ?? [];
  entriesByDay[input.dayKey] = [...current, entry];

  return toPublicEntry(entry);
};

/**
 * Returns all entries grouped by day key without internal dayKey duplication.
 */
export const getDayEntriesMap = (): Record<string, DayEntry[]> => {
  const grouped: Record<string, DayEntry[]> = {};

  Object.entries(entriesByDay).forEach(([dayKey, entries]) => {
    grouped[dayKey] = entries.map(toPublicEntry);
  });

  return grouped;
};

export const getDayEntryById = (id: string): DayEntry | undefined => {
  for (const entries of Object.values(entriesByDay)) {
    const entry = entries.find((item) => item.id === id);
    if (entry) return toPublicEntry(entry);
  }

  return undefined;
};

export const deleteDayEntry = (id: string): string | undefined => {
  for (const [dayKey, entries] of Object.entries(entriesByDay)) {
    const nextEntries = entries.filter((entry) => entry.id !== id);
    if (nextEntries.length === entries.length) continue;

    if (nextEntries.length === 0) {
      delete entriesByDay[dayKey];
    } else {
      entriesByDay[dayKey] = nextEntries;
    }

    return dayKey;
  }

  return undefined;
};
