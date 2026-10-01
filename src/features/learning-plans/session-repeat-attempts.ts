import type { SessionAnswerAttempt } from "./types";

// Pending excludes old answers until a repeated route receives its first snapshot.
export type RepeatAttemptBaseline = ReadonlySet<string> | "pending" | null;

export function captureRepeatAttemptBaseline(
	attempts: SessionAnswerAttempt[],
	localAttempt: SessionAnswerAttempt | null = null,
): ReadonlySet<string> {
	return new Set([
		...attempts.map((attempt) => attempt.id),
		...(localAttempt ? [localAttempt.id] : []),
	]);
}

export function getCurrentRunAttempts(
	attempts: SessionAnswerAttempt[],
	localAttempt: SessionAnswerAttempt | null,
	baseline: RepeatAttemptBaseline,
): SessionAnswerAttempt[] {
	if (baseline === "pending") return [];
	const current = attempts.filter((attempt) => !baseline?.has(attempt.id));
	if (
		localAttempt &&
		!baseline?.has(localAttempt.id) &&
		!current.some((attempt) => attempt.id === localAttempt.id)
	) {
		return [...current, localAttempt];
	}
	return current;
}
