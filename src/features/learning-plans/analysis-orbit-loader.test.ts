import { describe, expect, test } from "vitest";
import {
	ANALYSIS_ORBIT_CENTER,
	ANALYSIS_ORBIT_LOADER_SIZE,
	ANALYSIS_ORBIT_PETAL_DISTANCE,
	ANALYSIS_ORBIT_PETAL_SIZE,
	ANALYSIS_ORBIT_PETALS,
	getAnalysisOrbitPetalPosition,
} from "./analysis-orbit-loader";

describe("analysis orbit loader geometry", () => {
	test("folds every petal into one centered circle", () => {
		for (const petal of ANALYSIS_ORBIT_PETALS) {
			expect(getAnalysisOrbitPetalPosition(petal, 0)).toEqual({
				cx: ANALYSIS_ORBIT_CENTER,
				cy: ANALYSIS_ORBIT_CENTER,
			});
		}
	});

	test("expands every petal back to its orbit position", () => {
		for (const petal of ANALYSIS_ORBIT_PETALS) {
			const position = getAnalysisOrbitPetalPosition(petal, 1);
			expect(position.cx).toBeCloseTo(petal.cx);
			expect(position.cy).toBeCloseTo(petal.cy);
		}
	});

	test("opens wider while staying inside the loader bounds", () => {
		expect(ANALYSIS_ORBIT_PETAL_DISTANCE).toBeGreaterThan(64);

		const petalRadius = ANALYSIS_ORBIT_PETAL_SIZE / 2;
		for (const petal of ANALYSIS_ORBIT_PETALS) {
			expect(petal.cx - petalRadius).toBeGreaterThanOrEqual(0);
			expect(petal.cx + petalRadius).toBeLessThanOrEqual(
				ANALYSIS_ORBIT_LOADER_SIZE,
			);
			expect(petal.cy - petalRadius).toBeGreaterThanOrEqual(0);
			expect(petal.cy + petalRadius).toBeLessThanOrEqual(
				ANALYSIS_ORBIT_LOADER_SIZE,
			);
		}
	});
});
