import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const ANALYTICS_PATH = resolve(process.cwd(), "src/lib/analytics.ts");

describe("validation analytics policy", () => {
	test("captures one-shot events before starting Convex activity marking", () => {
		const source = readFileSync(ANALYTICS_PATH, "utf8");
		const captureStart = source.indexOf("const capture = useCallback");
		const captureEnd = source.indexOf("\n\treturn { capture };", captureStart);
		const captureBody = source.slice(captureStart, captureEnd);
		const eventCapture = captureBody.indexOf("captureValidationEvent(");
		const activityMark = captureBody.indexOf("void markActivity(");

		expect(captureStart).toBeGreaterThanOrEqual(0);
		expect(captureEnd).toBeGreaterThan(captureStart);
		expect(captureBody).not.toContain("async (");
		expect(eventCapture).toBeGreaterThanOrEqual(0);
		expect(activityMark).toBeGreaterThan(eventCapture);
	});
});
