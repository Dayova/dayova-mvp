import { describe, expect, it } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import {
	captureRepeatAttemptBaseline,
	getCurrentRunAttempts,
} from "./session-repeat-attempts";
import type { SessionAnswerAttempt } from "./types";

const attempt = (id: string, createdAt: number): SessionAnswerAttempt => ({
	id: id as Id<"learningSessionAnswerAttempts">,
	itemId: "item" as Id<"learningSessionContentItems">,
	sessionId: "session" as Id<"learningPlanSessions">,
	rating: "correct",
	feedback: "Richtig",
	perfectAnswer: "Antwort",
	createdAt,
});

describe("repeat answer isolation", () => {
	it("keeps new answers regardless of timestamps or client clock skew", () => {
		const old = attempt("old", 10_000);
		const baseline = captureRepeatAttemptBaseline([old]);
		for (const timestamp of [1, 10_000, 1_000_000]) {
			const fresh = attempt("fresh", timestamp);
			expect(getCurrentRunAttempts([old, fresh], null, baseline)).toEqual([
				fresh,
			]);
		}
	});

	it("hides previous answers while a repeated route awaits initial content", () => {
		const old = attempt("old", 1);
		expect(getCurrentRunAttempts([old], old, "pending")).toEqual([]);
		const baseline = captureRepeatAttemptBaseline([old]);
		expect(getCurrentRunAttempts([old], null, baseline)).toEqual([]);
	});

	it("excludes a previous local answer even before its subscription update", () => {
		const old = attempt("old", 1);
		const local = attempt("local", 2);
		const baseline = captureRepeatAttemptBaseline([old], local);
		expect(getCurrentRunAttempts([old, local], null, baseline)).toEqual([]);
	});

	it("shows a fresh local answer once before and after subscription delivery", () => {
		const old = attempt("old", 1);
		const fresh = attempt("fresh", 2);
		const baseline = captureRepeatAttemptBaseline([old]);
		expect(getCurrentRunAttempts([old], fresh, baseline)).toEqual([fresh]);
		expect(getCurrentRunAttempts([old, fresh], fresh, baseline)).toEqual([
			fresh,
		]);
	});

	it("takes a new baseline for each repeat while ordinary sessions retain answers", () => {
		const first = attempt("first", 1);
		const second = attempt("second", 2);
		const third = attempt("third", 3);
		expect(getCurrentRunAttempts([first], null, null)).toEqual([first]);
		const baseline = captureRepeatAttemptBaseline([second]);
		expect(getCurrentRunAttempts([second, third], null, baseline)).toEqual([
			third,
		]);
	});
});
