import { isGermanFederalState } from "~/lib/federal-states";
import { isSupportedGrade } from "~/lib/grades";
import { isSupportedSchoolType } from "~/lib/school-types";
import {
	getOnboardingLearningTimeWindow,
	parseOnboardingDurationMinutes,
	parseOnboardingStudyDays,
} from "~/components/onboarding/onboarding-learning-times";

const STORAGE_KEY_PREFIX = "dayova.pending-onboarding-sync";
const SCHEMA_VERSION = 1;
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACCOUNT_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

export type PendingOnboardingSyncAnswers = {
	dailySchoolTime: string;
	studyDays: string;
	learningTime: string;
	state: string;
	schoolType: string;
	grade: string;
};

type PendingRecord = {
	version: typeof SCHEMA_VERSION;
	status: "pending";
	registrationAttemptId: string;
	accountFingerprint: string;
	clerkUserId?: string;
	createdAt: number;
	answers: PendingOnboardingSyncAnswers;
};

type ReadyForTrialRecord = {
	version: typeof SCHEMA_VERSION;
	status: "ready_for_trial";
	registrationAttemptId: string;
	accountFingerprint: string;
	clerkUserId: string;
	createdAt: number;
};

type RecoveryRequiredRecord = {
	version: typeof SCHEMA_VERSION;
	status: "recovery_required";
	registrationAttemptId: string;
	accountFingerprint: string;
	clerkUserId: string;
	createdAt: number;
	reason: "expired" | "invalid";
};

type StoredRecord =
	| PendingRecord
	| ReadyForTrialRecord
	| RecoveryRequiredRecord;

export type PendingOnboardingSyncStorage = {
	getItem: (key: string) => Promise<string | null>;
	setItem: (key: string, value: string) => Promise<void>;
	deleteItem: (key: string) => Promise<void>;
};

type AccountIdentity = {
	clerkUserId: string;
	accountFingerprint: string;
	registrationAttemptId?: string;
};

export type PendingOnboardingSyncResumeResult =
	| { status: "none" }
	| { status: "pending"; answers: PendingOnboardingSyncAnswers }
	| { status: "ready_for_trial" }
	| { status: "recovery_required"; reason: "expired" | "invalid" };

export const getPendingOnboardingSyncTransition = (
	result: PendingOnboardingSyncResumeResult,
) => ({
	result,
	shouldFinalize: result.status === "ready_for_trial",
});

export type PendingOnboardingSyncErrorCode =
	| "invalid_payload"
	| "payload_unavailable"
	| "completion_unavailable";

export class PendingOnboardingSyncError extends Error {
	readonly code: PendingOnboardingSyncErrorCode;

	constructor(code: PendingOnboardingSyncErrorCode, message: string) {
		super(message);
		this.name = "PendingOnboardingSyncError";
		this.code = code;
	}
}

const isRecordBase = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isValidAnswers = (
	value: unknown,
): value is PendingOnboardingSyncAnswers => {
	if (!isRecordBase(value)) return false;
	const dailySchoolTime = value.dailySchoolTime;
	const studyDays = value.studyDays;
	const learningTime = value.learningTime;
	const state = value.state;
	const schoolType = value.schoolType;
	const grade = value.grade;
	if (
		typeof dailySchoolTime !== "string" ||
		typeof studyDays !== "string" ||
		typeof learningTime !== "string" ||
		typeof state !== "string" ||
		typeof schoolType !== "string" ||
		typeof grade !== "string"
	) {
		return false;
	}

	const duration = dailySchoolTime.endsWith(" min")
		? parseOnboardingDurationMinutes(dailySchoolTime.slice(0, -4))
		: null;
	const parsedDays = parseOnboardingStudyDays(studyDays);
	const canonicalDays = parsedDays.join(", ");
	return Boolean(
		duration !== null &&
			parsedDays.length > 0 &&
			canonicalDays === studyDays &&
			getOnboardingLearningTimeWindow({
				studyTime: String(duration),
				learningTime,
			}) &&
			isGermanFederalState(state) &&
			isSupportedSchoolType(schoolType) &&
			isSupportedGrade(grade),
	);
};

const parseStoredRecord = (serialized: string): StoredRecord | null => {
	let value: unknown;
	try {
		value = JSON.parse(serialized);
	} catch {
		return null;
	}
	if (!isRecordBase(value)) return null;
	if (
		value.version !== SCHEMA_VERSION ||
		(value.status !== "pending" &&
			value.status !== "ready_for_trial" &&
			value.status !== "recovery_required") ||
		typeof value.registrationAttemptId !== "string" ||
		value.registrationAttemptId.length === 0 ||
		typeof value.accountFingerprint !== "string" ||
		!ACCOUNT_FINGERPRINT_PATTERN.test(value.accountFingerprint) ||
		typeof value.createdAt !== "number" ||
		!Number.isFinite(value.createdAt) ||
		(value.clerkUserId !== undefined && typeof value.clerkUserId !== "string")
	) {
		return null;
	}

	if (value.status === "pending") {
		if (!isValidAnswers(value.answers)) return null;
		return {
			version: SCHEMA_VERSION,
			status: "pending",
			registrationAttemptId: value.registrationAttemptId,
			accountFingerprint: value.accountFingerprint,
			...(value.clerkUserId ? { clerkUserId: value.clerkUserId } : {}),
			createdAt: value.createdAt,
			answers: value.answers,
		};
	}

	if (!value.clerkUserId || typeof value.clerkUserId !== "string") return null;
	if (value.status === "recovery_required") {
		if (value.reason !== "expired" && value.reason !== "invalid") return null;
		return {
			version: SCHEMA_VERSION,
			status: "recovery_required",
			registrationAttemptId: value.registrationAttemptId,
			accountFingerprint: value.accountFingerprint,
			clerkUserId: value.clerkUserId,
			createdAt: value.createdAt,
			reason: value.reason,
		};
	}
	return {
		version: SCHEMA_VERSION,
		status: "ready_for_trial",
		registrationAttemptId: value.registrationAttemptId,
		accountFingerprint: value.accountFingerprint,
		clerkUserId: value.clerkUserId,
		createdAt: value.createdAt,
	};
};

const matchesAccount = (record: StoredRecord, identity: AccountIdentity) =>
	record.accountFingerprint === identity.accountFingerprint &&
	(!record.clerkUserId || record.clerkUserId === identity.clerkUserId);

const storageKey = (accountFingerprint: string) =>
	`${STORAGE_KEY_PREFIX}.${accountFingerprint}`;

export const createPendingOnboardingSyncOutbox = ({
	storage,
	now = Date.now,
	ttlMs = DEFAULT_TTL_MS,
}: {
	storage: PendingOnboardingSyncStorage;
	now?: () => number;
	ttlMs?: number;
}) => {
	const read = async (
		accountFingerprint: string,
	): Promise<StoredRecord | null | "invalid"> => {
		const serialized = await storage.getItem(storageKey(accountFingerprint));
		if (!serialized) return null;
		return parseStoredRecord(serialized) ?? "invalid";
	};

	const write = (record: StoredRecord) =>
		storage.setItem(
			storageKey(record.accountFingerprint),
			JSON.stringify(record),
		);
	const isExpiredPendingRecord = (createdAt: number) => {
		const elapsedMs = now() - createdAt;
		return elapsedMs < 0 || elapsedMs > ttlMs;
	};
	const accountOperationQueues = new Map<string, Promise<unknown>>();
	const serializeAccountOperation = <TResult>(
		accountFingerprint: string,
		operation: () => Promise<TResult>,
	): Promise<TResult> => {
		const previous = accountOperationQueues.get(accountFingerprint);
		const current = (previous ?? Promise.resolve())
			.catch(() => undefined)
			.then(operation);
		accountOperationQueues.set(accountFingerprint, current);
		return current.finally(() => {
			if (accountOperationQueues.get(accountFingerprint) === current) {
				accountOperationQueues.delete(accountFingerprint);
			}
		});
	};

	return {
		stage: async ({
			registrationAttemptId,
			accountFingerprint,
			answers,
		}: {
			registrationAttemptId: string;
			accountFingerprint: string;
			answers: PendingOnboardingSyncAnswers;
		}) => {
			if (
				registrationAttemptId.length === 0 ||
				!ACCOUNT_FINGERPRINT_PATTERN.test(accountFingerprint) ||
				!isValidAnswers(answers)
			) {
				throw new PendingOnboardingSyncError(
					"invalid_payload",
					"Invalid pending onboarding sync payload.",
				);
			}
			return serializeAccountOperation(accountFingerprint, async () => {
				const existingRecord = await read(accountFingerprint);
				if (
					existingRecord !== null &&
					existingRecord !== "invalid" &&
					existingRecord.clerkUserId &&
					!(
						existingRecord.status === "pending" &&
						isExpiredPendingRecord(existingRecord.createdAt)
					)
				) {
					throw new PendingOnboardingSyncError(
						"payload_unavailable",
						"Pending onboarding sync payload is unavailable.",
					);
				}
				await write({
					version: SCHEMA_VERSION,
					status: "pending",
					registrationAttemptId,
					accountFingerprint,
					createdAt: now(),
					answers,
				});
			});
		},

		stageForUser: async ({
			registrationAttemptId,
			clerkUserId,
			accountFingerprint,
			answers,
		}: AccountIdentity & {
			registrationAttemptId: string;
			answers: PendingOnboardingSyncAnswers;
		}) => {
			if (
				registrationAttemptId.length === 0 ||
				clerkUserId.length === 0 ||
				!ACCOUNT_FINGERPRINT_PATTERN.test(accountFingerprint) ||
				!isValidAnswers(answers)
			) {
				throw new PendingOnboardingSyncError(
					"invalid_payload",
					"Invalid pending onboarding sync payload.",
				);
			}
			return serializeAccountOperation(accountFingerprint, async () => {
				const existingRecord = await read(accountFingerprint);
				if (
					existingRecord !== null &&
					existingRecord !== "invalid" &&
					existingRecord.clerkUserId &&
					existingRecord.clerkUserId !== clerkUserId
				) {
					throw new PendingOnboardingSyncError(
						"payload_unavailable",
						"Pending onboarding sync payload is unavailable.",
					);
				}
				await write({
					version: SCHEMA_VERSION,
					status: "pending",
					registrationAttemptId,
					clerkUserId,
					accountFingerprint,
					createdAt: now(),
					answers,
				});
			});
		},

		ensureStaged: async ({
			registrationAttemptId,
			accountFingerprint,
		}: {
			registrationAttemptId: string;
			accountFingerprint: string;
		}) => {
			return serializeAccountOperation(accountFingerprint, async () => {
				const record = await read(accountFingerprint);
				if (
					record === null ||
					record === "invalid" ||
					record.status !== "pending" ||
					record.registrationAttemptId !== registrationAttemptId ||
					record.accountFingerprint !== accountFingerprint ||
					isExpiredPendingRecord(record.createdAt)
				) {
					throw new PendingOnboardingSyncError(
						"payload_unavailable",
						"Pending onboarding sync payload is unavailable.",
					);
				}
			});
		},

		bindToUser: async ({
			registrationAttemptId,
			clerkUserId,
			accountFingerprint,
		}: AccountIdentity & { registrationAttemptId: string }) => {
			return serializeAccountOperation(accountFingerprint, async () => {
				const record = await read(accountFingerprint);
				if (
					record === null ||
					record === "invalid" ||
					record.status !== "pending" ||
					record.registrationAttemptId !== registrationAttemptId ||
					record.accountFingerprint !== accountFingerprint ||
					(record.clerkUserId && record.clerkUserId !== clerkUserId) ||
					isExpiredPendingRecord(record.createdAt)
				) {
					throw new PendingOnboardingSyncError(
						"payload_unavailable",
						"Pending onboarding sync payload is unavailable.",
					);
				}
				await write({ ...record, clerkUserId });
			});
		},

		resume: async (
			identity: AccountIdentity,
		): Promise<PendingOnboardingSyncResumeResult> =>
			serializeAccountOperation(identity.accountFingerprint, async () => {
				const record = await read(identity.accountFingerprint);
				if (record === null) return { status: "none" };
				if (record === "invalid") {
					await write({
						version: SCHEMA_VERSION,
						status: "recovery_required",
						registrationAttemptId: "recovery",
						accountFingerprint: identity.accountFingerprint,
						clerkUserId: identity.clerkUserId,
						createdAt: now(),
						reason: "invalid",
					});
					return { status: "recovery_required", reason: "invalid" };
				}
				if (!matchesAccount(record, identity)) return { status: "none" };
				if (
					!record.clerkUserId &&
					identity.registrationAttemptId !== record.registrationAttemptId
				) {
					return { status: "none" };
				}
				if (record.status === "recovery_required") {
					return { status: "recovery_required", reason: record.reason };
				}
				if (record.status === "ready_for_trial") {
					return { status: "ready_for_trial" };
				}
				if (isExpiredPendingRecord(record.createdAt)) {
					await write({
						version: SCHEMA_VERSION,
						status: "recovery_required",
						registrationAttemptId: record.registrationAttemptId,
						accountFingerprint: identity.accountFingerprint,
						clerkUserId: identity.clerkUserId,
						createdAt: now(),
						reason: "expired",
					});
					return { status: "recovery_required", reason: "expired" };
				}

				if (!record.clerkUserId) {
					record.clerkUserId = identity.clerkUserId;
					await write(record);
				}
				return { status: "pending", answers: record.answers };
			}),

		markSynced: async (identity: AccountIdentity) => {
			return serializeAccountOperation(
				identity.accountFingerprint,
				async () => {
					const record = await read(identity.accountFingerprint);
					if (
						record === null ||
						record === "invalid" ||
						record.status !== "pending" ||
						!record.clerkUserId ||
						!matchesAccount(record, identity)
					) {
						throw new PendingOnboardingSyncError(
							"payload_unavailable",
							"Pending onboarding sync payload is unavailable.",
						);
					}
					await write({
						version: SCHEMA_VERSION,
						status: "ready_for_trial",
						registrationAttemptId: record.registrationAttemptId,
						accountFingerprint: record.accountFingerprint,
						clerkUserId: record.clerkUserId,
						createdAt: record.createdAt,
					});
				},
			);
		},

		acknowledgeCompletion: async (identity: AccountIdentity) => {
			return serializeAccountOperation(
				identity.accountFingerprint,
				async () => {
					const record = await read(identity.accountFingerprint);
					if (record === null) return;
					if (
						record === "invalid" ||
						record.status !== "ready_for_trial" ||
						!matchesAccount(record, identity)
					) {
						throw new PendingOnboardingSyncError(
							"completion_unavailable",
							"Completed onboarding sync payload is unavailable.",
						);
					}
					await storage.deleteItem(storageKey(identity.accountFingerprint));
				},
			);
		},
	};
};

const pendingSyncOperationQueues = new WeakMap<
	object,
	Map<string, Promise<unknown>>
>();

const serializePendingSyncOperation = <TResult>({
	outbox,
	accountFingerprint,
	operation,
}: {
	outbox: object;
	accountFingerprint: string;
	operation: () => Promise<TResult>;
}) => {
	let accountQueues = pendingSyncOperationQueues.get(outbox);
	if (!accountQueues) {
		accountQueues = new Map<string, Promise<unknown>>();
		pendingSyncOperationQueues.set(outbox, accountQueues);
	}
	const previous = accountQueues.get(accountFingerprint);
	const current = (previous ?? Promise.resolve())
		.catch(() => undefined)
		.then(operation);
	accountQueues.set(accountFingerprint, current);

	return current.finally(() => {
		if (accountQueues?.get(accountFingerprint) === current) {
			accountQueues.delete(accountFingerprint);
			if (accountQueues.size === 0) pendingSyncOperationQueues.delete(outbox);
		}
	});
};

export const syncPendingOnboardingAnswers = async ({
	outbox,
	identity,
	sync,
}: {
	outbox: ReturnType<typeof createPendingOnboardingSyncOutbox>;
	identity: AccountIdentity;
	sync: (answers: PendingOnboardingSyncAnswers) => Promise<unknown>;
}) =>
	serializePendingSyncOperation({
		outbox,
		accountFingerprint: identity.accountFingerprint,
		operation: async () => {
			const pending = await outbox.resume(identity);
			if (pending.status !== "pending") return pending;
			await sync(pending.answers);
			await outbox.markSynced(identity);
			return { status: "ready_for_trial" } as const;
		},
	});
