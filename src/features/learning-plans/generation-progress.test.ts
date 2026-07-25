import { describe, expect, it } from "vitest";
import { getGenerationProgressPresentation } from "./generation-progress";

describe("getGenerationProgressPresentation", () => {
	it("explains persisted session-content progress", () => {
		expect(
			getGenerationProgressPresentation({
				stage: "content",
				totalSessionCount: 14,
				readySessionCount: 5,
				failedSessionCount: 0,
			}),
		).toEqual({
			label: "Fragen und Aufgaben für 5 von 14 Lernsessionen erstellt",
			progress: 5 / 14,
			canRetryFailedSessions: false,
		});
	});

	it("surfaces targeted retry when only some sessions failed", () => {
		expect(
			getGenerationProgressPresentation({
				stage: "failed",
				totalSessionCount: 14,
				readySessionCount: 12,
				failedSessionCount: 2,
			}),
		).toEqual({
			label: "2 Lernsessionen konnten noch nicht erstellt werden",
			progress: 12 / 14,
			canRetryFailedSessions: true,
		});
	});

	it("offers a full retry when generation failed before sessions existed", () => {
		expect(
			getGenerationProgressPresentation({
				stage: "failed",
				totalSessionCount: 0,
				readySessionCount: 0,
				failedSessionCount: 0,
			}),
		).toEqual({
			label: "Der Lernplan konnte noch nicht erstellt werden",
			progress: 0,
			canRetryFailedSessions: true,
		});
	});

	it("treats completed validation as full progress", () => {
		expect(
			getGenerationProgressPresentation({
				stage: "ready",
				totalSessionCount: 14,
				readySessionCount: 14,
				failedSessionCount: 0,
			}),
		).toEqual({
			label: "Alle Lernsessionen sind bereit",
			progress: 1,
			canRetryFailedSessions: false,
		});
	});
});
