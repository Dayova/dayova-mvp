export const ANALYSIS_ORBIT_LOADER_SIZE = 360;
export const ANALYSIS_ORBIT_PETAL_SIZE = 174;

// Expanded-state distance from the loader center to each petal center.
// Keep this below `loaderRadius - petalRadius` so petals never clip, and below
// the petal radius so the expanded flower still overlaps in the middle instead
// of opening a hole. This is the one design knob for "more or less expanded."
export const ANALYSIS_ORBIT_PETAL_DISTANCE = 86;
export const ANALYSIS_ORBIT_CENTER = ANALYSIS_ORBIT_LOADER_SIZE / 2;

export type AnalysisOrbitPetal = {
	id: string;
	cx: number;
	cy: number;
};

export const ANALYSIS_ORBIT_PETALS: AnalysisOrbitPetal[] = Array.from(
	{ length: 9 },
	(_, index) => {
		// Nine petals at 40-degree increments gives a full 360-degree flower.
		// These expanded positions are static, so they are calculated once at
		// module load rather than recomputed during every animation frame.
		const angle = (index * 40 * Math.PI) / 180;
		return {
			id: `analysis-orbit-${index}`,
			cx:
				ANALYSIS_ORBIT_CENTER + Math.sin(angle) * ANALYSIS_ORBIT_PETAL_DISTANCE,
			cy:
				ANALYSIS_ORBIT_CENTER - Math.cos(angle) * ANALYSIS_ORBIT_PETAL_DISTANCE,
		};
	},
);

export const getAnalysisOrbitPetalPosition = (
	petal: AnalysisOrbitPetal,
	foldProgress: number,
) => {
	"worklet";

	// `foldProgress` is intentionally geometry-only:
	// - 1 means fully expanded at the petal's orbit position.
	// - 0 means fully folded, with every petal centered on the exact same point.
	//
	// That is what makes the loader collapse to one circle instead of shrinking
	// the whole flower down to a smaller, still-expanded flower.
	const progress = Math.min(Math.max(foldProgress, 0), 1);
	return {
		cx: ANALYSIS_ORBIT_CENTER + (petal.cx - ANALYSIS_ORBIT_CENTER) * progress,
		cy: ANALYSIS_ORBIT_CENTER + (petal.cy - ANALYSIS_ORBIT_CENTER) * progress,
	};
};
