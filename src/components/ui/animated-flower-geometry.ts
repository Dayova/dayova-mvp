export const ANIMATED_FLOWER_BASE_SIZE = 360;
export const ANIMATED_FLOWER_BASE_PETAL_SIZE = 174;
export const ANIMATED_FLOWER_BASE_PETAL_DISTANCE = 86;

export type AnimatedFlowerPetal = {
	id: string;
	cx: number;
	cy: number;
};

export type AnimatedFlowerGeometry = {
	center: number;
	petalDistance: number;
	petalSize: number;
	petals: AnimatedFlowerPetal[];
	size: number;
};

export const getAnimatedFlowerGeometry = (
	size = ANIMATED_FLOWER_BASE_SIZE,
): AnimatedFlowerGeometry => {
	const scale = size / ANIMATED_FLOWER_BASE_SIZE;
	const center = size / 2;
	const petalSize = ANIMATED_FLOWER_BASE_PETAL_SIZE * scale;
	const petalDistance = ANIMATED_FLOWER_BASE_PETAL_DISTANCE * scale;
	const petals = Array.from({ length: 9 }, (_, index) => {
		const angle = (index * 40 * Math.PI) / 180;
		return {
			id: `animated-flower-petal-${index}`,
			cx: center + Math.sin(angle) * petalDistance,
			cy: center - Math.cos(angle) * petalDistance,
		};
	});

	return {
		center,
		petalDistance,
		petalSize,
		petals,
		size,
	};
};

export const getAnimatedFlowerPetalPosition = (
	petal: AnimatedFlowerPetal,
	foldProgress: number,
	center: number,
) => {
	"worklet";

	const progress = Math.min(Math.max(foldProgress, 0), 1);
	return {
		cx: center + (petal.cx - center) * progress,
		cy: center + (petal.cy - center) * progress,
	};
};
