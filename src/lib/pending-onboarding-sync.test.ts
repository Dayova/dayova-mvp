import { describe, expect, it, vi } from "vitest";
import {
	createPendingOnboardingSyncOutbox,
	syncPendingOnboardingAnswers,
	type PendingOnboardingSyncStorage,
} from "./pending-onboarding-sync";

const ANSWERS = {
	dailySchoolTime: "30 min",
	studyDays: "Montag, Mittwoch, Samstag",
	learningTime: "16:00",
	state: "Sachsen",
	schoolType: "gymnasium" as const,
	grade: "10",
};

const ACCOUNT_FINGERPRINT = "a".repeat(64);
const OTHER_ACCOUNT_FINGERPRINT = "b".repeat(64);

const createMemoryStorage = () => {
	const values = new Map<string, string>();
	const storage: PendingOnboardingSyncStorage = {
		getItem: vi.fn(async (key) => values.get(key) ?? null),
		setItem: vi.fn(async (key, value) => {
			values.set(key, value);
		}),
		deleteItem: vi.fn(async (key) => {
			values.delete(key);
		}),
	};
	return { storage, values };
};

describe("pending onboarding sync outbox", () => {
	it("resumes the exact account-bound answers after a process restart and removes the payload only after sync", async () => {
		const { storage, values } = createMemoryStorage();
		const firstProcess = createPendingOnboardingSyncOutbox({
			storage,
			now: () => Date.UTC(2026, 7, 13, 10),
		});

		await firstProcess.stage({
			registrationAttemptId: "signup_123",
			accountFingerprint: ACCOUNT_FINGERPRINT,
			answers: ANSWERS,
		});
		await firstProcess.bindToUser({
			registrationAttemptId: "signup_123",
			accountFingerprint: ACCOUNT_FINGERPRINT,
			clerkUserId: "user_123",
		});

		const serialized = [...values.values()][0];
		expect(serialized).toContain("Montag, Mittwoch, Samstag");
		expect(serialized).not.toContain("password");
		expect(serialized).not.toContain("learner@example.com");

		const restartedProcess = createPendingOnboardingSyncOutbox({
			storage,
			now: () => Date.UTC(2026, 7, 13, 10, 5),
		});
		await expect(
			restartedProcess.resume({
				clerkUserId: "user_123",
				accountFingerprint: ACCOUNT_FINGERPRINT,
				registrationAttemptId: "signup_123",
			}),
		).resolves.toEqual({ status: "pending", answers: ANSWERS });

		await restartedProcess.markSynced({
			clerkUserId: "user_123",
			accountFingerprint: ACCOUNT_FINGERPRINT,
		});
		expect([...values.values()][0]).not.toContain("Montag");
		await expect(
			restartedProcess.resume({
				clerkUserId: "user_123",
				accountFingerprint: ACCOUNT_FINGERPRINT,
			}),
		).resolves.toEqual({ status: "ready_for_trial" });

		await restartedProcess.acknowledgeCompletion({
			clerkUserId: "user_123",
			accountFingerprint: ACCOUNT_FINGERPRINT,
		});
		await expect(
			restartedProcess.resume({
				clerkUserId: "user_123",
				accountFingerprint: ACCOUNT_FINGERPRINT,
			}),
		).resolves.toEqual({ status: "none" });
	});

	it("claims an unbound pre-verification payload only for the matching account", async () => {
		const { storage } = createMemoryStorage();
		const outbox = createPendingOnboardingSyncOutbox({
			storage,
			now: () => Date.UTC(2026, 7, 13, 10),
		});
		await outbox.stage({
			registrationAttemptId: "signup_123",
			accountFingerprint: ACCOUNT_FINGERPRINT,
			answers: ANSWERS,
		});

		await expect(
			outbox.resume({
				clerkUserId: "user_other",
				accountFingerprint: OTHER_ACCOUNT_FINGERPRINT,
			}),
		).resolves.toEqual({ status: "none" });
		await expect(
			outbox.resume({
				clerkUserId: "existing_user_same_email",
				accountFingerprint: ACCOUNT_FINGERPRINT,
			}),
		).resolves.toEqual({ status: "none" });
		await expect(
			outbox.resume({
				clerkUserId: "user_123",
				accountFingerprint: ACCOUNT_FINGERPRINT,
				registrationAttemptId: "signup_123",
			}),
		).resolves.toEqual({ status: "pending", answers: ANSWERS });
		await expect(
			outbox.resume({
				clerkUserId: "user_other",
				accountFingerprint: ACCOUNT_FINGERPRINT,
				registrationAttemptId: "signup_123",
			}),
		).resolves.toEqual({ status: "none" });
	});

	it("preserves an account-bound payload when the same email starts another registration", async () => {
		const { storage } = createMemoryStorage();
		const outbox = createPendingOnboardingSyncOutbox({
			storage,
			now: () => Date.UTC(2026, 7, 13, 10),
		});
		await outbox.stage({
			registrationAttemptId: "signup_123",
			accountFingerprint: ACCOUNT_FINGERPRINT,
			answers: ANSWERS,
		});
		await outbox.bindToUser({
			registrationAttemptId: "signup_123",
			accountFingerprint: ACCOUNT_FINGERPRINT,
			clerkUserId: "user_123",
		});

		await expect(
			outbox.stage({
				registrationAttemptId: "signup_other",
				accountFingerprint: ACCOUNT_FINGERPRINT,
				answers: { ...ANSWERS, learningTime: "18:00" },
			}),
		).rejects.toMatchObject({ code: "payload_unavailable" });
		await expect(
			outbox.resume({
				clerkUserId: "user_123",
				accountFingerprint: ACCOUNT_FINGERPRINT,
			}),
		).resolves.toEqual({ status: "pending", answers: ANSWERS });
	});

	it("never replaces a payload that is bound to another account", async () => {
		const { storage } = createMemoryStorage();
		const outbox = createPendingOnboardingSyncOutbox({
			storage,
			now: () => Date.UTC(2026, 7, 13, 10),
		});
		await outbox.stageForUser({
			registrationAttemptId: "recovery",
			accountFingerprint: ACCOUNT_FINGERPRINT,
			clerkUserId: "user_123",
			answers: ANSWERS,
		});

		await expect(
			outbox.stageForUser({
				registrationAttemptId: "recovery",
				accountFingerprint: ACCOUNT_FINGERPRINT,
				clerkUserId: "user_other",
				answers: { ...ANSWERS, learningTime: "18:00" },
			}),
		).rejects.toMatchObject({ code: "payload_unavailable" });
		await expect(
			outbox.resume({
				clerkUserId: "user_123",
				accountFingerprint: ACCOUNT_FINGERPRINT,
			}),
		).resolves.toEqual({ status: "pending", answers: ANSWERS });
	});

	it("refuses account creation when the staged payload belongs to another registration attempt", async () => {
		const { storage } = createMemoryStorage();
		const outbox = createPendingOnboardingSyncOutbox({
			storage,
			now: () => Date.UTC(2026, 7, 13, 10),
		});
		await outbox.stage({
			registrationAttemptId: "signup_123",
			accountFingerprint: ACCOUNT_FINGERPRINT,
			answers: ANSWERS,
		});

		await expect(
			outbox.ensureStaged({
				registrationAttemptId: "signup_other",
				accountFingerprint: ACCOUNT_FINGERPRINT,
			}),
		).rejects.toThrow("unavailable");
		await expect(
			outbox.ensureStaged({
				registrationAttemptId: "signup_123",
				accountFingerprint: ACCOUNT_FINGERPRINT,
			}),
		).resolves.toBeUndefined();
	});

	it("rejects a future-dated pending payload before account creation", async () => {
		const { storage } = createMemoryStorage();
		const stagedProcess = createPendingOnboardingSyncOutbox({
			storage,
			now: () => Date.UTC(2026, 7, 13, 10, 5),
		});
		await stagedProcess.stage({
			registrationAttemptId: "signup_123",
			accountFingerprint: ACCOUNT_FINGERPRINT,
			answers: ANSWERS,
		});

		const clockMovedBack = createPendingOnboardingSyncOutbox({
			storage,
			now: () => Date.UTC(2026, 7, 13, 10),
		});
		await expect(
			clockMovedBack.ensureStaged({
				registrationAttemptId: "signup_123",
				accountFingerprint: ACCOUNT_FINGERPRINT,
			}),
		).rejects.toMatchObject({ code: "payload_unavailable" });
		await expect(
			clockMovedBack.bindToUser({
				registrationAttemptId: "signup_123",
				accountFingerprint: ACCOUNT_FINGERPRINT,
				clerkUserId: "user_123",
			}),
		).rejects.toMatchObject({ code: "payload_unavailable" });
	});

	it("keeps a failed answer sync retryable across a process restart and clears answers after success", async () => {
		const { storage } = createMemoryStorage();
		const identity = {
			clerkUserId: "user_123",
			accountFingerprint: ACCOUNT_FINGERPRINT,
		};
		const firstProcess = createPendingOnboardingSyncOutbox({
			storage,
			now: () => Date.UTC(2026, 7, 13, 10),
		});
		await firstProcess.stage({
			registrationAttemptId: "signup_123",
			accountFingerprint: ACCOUNT_FINGERPRINT,
			answers: ANSWERS,
		});
		await firstProcess.bindToUser({
			registrationAttemptId: "signup_123",
			accountFingerprint: ACCOUNT_FINGERPRINT,
			clerkUserId: "user_123",
		});
		const failedSync = vi.fn(async () => {
			throw new Error("network unavailable");
		});

		await expect(
			syncPendingOnboardingAnswers({
				outbox: firstProcess,
				identity,
				sync: failedSync,
			}),
		).rejects.toThrow("network unavailable");
		await expect(firstProcess.resume(identity)).resolves.toEqual({
			status: "pending",
			answers: ANSWERS,
		});

		const restartedProcess = createPendingOnboardingSyncOutbox({
			storage,
			now: () => Date.UTC(2026, 7, 13, 10, 5),
		});
		const successfulSync = vi.fn(async () => ({ success: true }));
		await expect(
			syncPendingOnboardingAnswers({
				outbox: restartedProcess,
				identity,
				sync: successfulSync,
			}),
		).resolves.toEqual({ status: "ready_for_trial" });
		expect(successfulSync).toHaveBeenCalledWith(ANSWERS);
		await expect(restartedProcess.resume(identity)).resolves.toEqual({
			status: "ready_for_trial",
		});
	});

	it("keeps the answer-free completion marker until the learner acknowledges it", async () => {
		const { storage } = createMemoryStorage();
		const firstProcess = createPendingOnboardingSyncOutbox({
			storage,
			now: () => Date.UTC(2026, 7, 1),
		});
		const identity = {
			clerkUserId: "user_123",
			accountFingerprint: ACCOUNT_FINGERPRINT,
		};
		await firstProcess.stageForUser({
			...identity,
			registrationAttemptId: "signup_123",
			answers: ANSWERS,
		});
		await firstProcess.markSynced(identity);

		const restartedAfterTtl = createPendingOnboardingSyncOutbox({
			storage,
			now: () => Date.UTC(2026, 7, 13),
		});
		await expect(restartedAfterTtl.resume(identity)).resolves.toEqual({
			status: "ready_for_trial",
		});
	});

	it.each([
		["invalid", "not-json"],
		[
			"expired",
			JSON.stringify({
				version: 1,
				status: "pending",
				registrationAttemptId: "signup_123",
				accountFingerprint: ACCOUNT_FINGERPRINT,
				clerkUserId: "user_123",
				createdAt: Date.UTC(2026, 7, 1),
				answers: ANSWERS,
			}),
		],
		[
			"expired",
			JSON.stringify({
				version: 1,
				status: "pending",
				registrationAttemptId: "signup_123",
				accountFingerprint: ACCOUNT_FINGERPRINT,
				clerkUserId: "user_123",
				createdAt: Date.UTC(2026, 7, 13, 10, 5),
				answers: ANSWERS,
			}),
		],
	] as const)("never applies and removes an %s payload", async (reason, serialized) => {
		const { storage, values } = createMemoryStorage();
		values.set(
			`dayova.pending-onboarding-sync.${ACCOUNT_FINGERPRINT}`,
			serialized,
		);
		const outbox = createPendingOnboardingSyncOutbox({
			storage,
			now: () => Date.UTC(2026, 7, 13, 10),
		});

		await expect(
			outbox.resume({
				clerkUserId: "user_123",
				accountFingerprint: ACCOUNT_FINGERPRINT,
			}),
		).resolves.toEqual({ status: "recovery_required", reason });
		expect([...values.values()][0]).not.toContain("Montag");
		await expect(
			outbox.resume({
				clerkUserId: "user_123",
				accountFingerprint: ACCOUNT_FINGERPRINT,
			}),
		).resolves.toEqual({ status: "recovery_required", reason });
	});
});
