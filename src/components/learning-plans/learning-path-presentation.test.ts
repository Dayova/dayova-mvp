import { describe, expect, test } from "vitest";
import { getLearningPathNodeIconKind } from "./learning-path-presentation";

describe("learning path presentation", () => {
	test("uses a completion mark or the session type icon for every node", () => {
		expect(getLearningPathNodeIconKind("theory", "completed")).toBe(
			"completed",
		);
		expect(getLearningPathNodeIconKind("theory", "current")).toBe("theory");
		expect(getLearningPathNodeIconKind("practice", "locked")).toBe("practice");
		expect(getLearningPathNodeIconKind("rehearsal", "locked")).toBe("repeat");
	});
});
