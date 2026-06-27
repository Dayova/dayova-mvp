export const ANALYSIS_ORBIT_LOADER_SIZE = 360;
export const ANALYSIS_ORBIT_PETAL_SIZE = 174;
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

	const progress = Math.min(Math.max(foldProgress, 0), 1);
	return {
		cx: ANALYSIS_ORBIT_CENTER + (petal.cx - ANALYSIS_ORBIT_CENTER) * progress,
		cy: ANALYSIS_ORBIT_CENTER + (petal.cy - ANALYSIS_ORBIT_CENTER) * progress,
	};
};
