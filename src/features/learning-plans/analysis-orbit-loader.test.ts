import { describe, expect, test } from "vitest";
import {
	ANALYSIS_ORBIT_CENTER,
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
});
