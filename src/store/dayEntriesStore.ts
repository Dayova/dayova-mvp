export type DayEntry = {
  id: string;
  title: string;
  time: string;
  kind?: string;
  notes?: string;
};

type StoredDayEntry = DayEntry & {
  dayKey: string;
};

const entriesByDay: Record<string, StoredDayEntry[]> = {};

/**
 * Adds a new day entry to the in-memory store.
 */
export const addDayEntry = (input: { dayKey: string; title: string; time: string; kind?: string; notes?: string }): DayEntry => {
  const entry: StoredDayEntry = {
    id: `${input.dayKey}-${Date.now()}`,
    dayKey: input.dayKey,
    title: input.title,
    time: input.time,
    kind: input.kind,
    notes: input.notes,
  };

  const current = entriesByDay[input.dayKey] ?? [];
  entriesByDay[input.dayKey] = [...current, entry];

  return { id: entry.id, title: entry.title, time: entry.time, kind: entry.kind, notes: entry.notes };
};

/**
 * Returns all entries grouped by day key without internal dayKey duplication.
 */
export const getDayEntriesMap = (): Record<string, DayEntry[]> => {
  const grouped: Record<string, DayEntry[]> = {};

  Object.entries(entriesByDay).forEach(([dayKey, entries]) => {
    grouped[dayKey] = entries.map(({ id, title, time, kind, notes }) => ({ id, title, time, kind, notes }));
  });

  return grouped;
};
