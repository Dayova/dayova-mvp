import { describe, expect, test } from "vitest";
import {
	ANIMATED_FLOWER_BASE_PETAL_DISTANCE,
	ANIMATED_FLOWER_BASE_PETAL_SIZE,
	ANIMATED_FLOWER_BASE_SIZE,
	getAnimatedFlowerGeometry,
	getAnimatedFlowerPetalPosition,
} from "./animated-flower-geometry";

describe("animated flower geometry", () => {
	test.each([
		ANIMATED_FLOWER_BASE_SIZE,
		190,
	])("folds every petal into one centered circle at size %i", (size) => {
		const geometry = getAnimatedFlowerGeometry(size);

		for (const petal of geometry.petals) {
			expect(getAnimatedFlowerPetalPosition(petal, 0, geometry.center)).toEqual(
				{
					cx: geometry.center,
					cy: geometry.center,
				},
			);
		}
	});

	test.each([
		ANIMATED_FLOWER_BASE_SIZE,
		190,
	])("expands every petal back to its orbit position at size %i", (size) => {
		const geometry = getAnimatedFlowerGeometry(size);

		for (const petal of geometry.petals) {
			const position = getAnimatedFlowerPetalPosition(
				petal,
				1,
				geometry.center,
			);
			expect(position.cx).toBeCloseTo(petal.cx);
			expect(position.cy).toBeCloseTo(petal.cy);
		}
	});

	test("preserves the canonical learning-plan geometry by default", () => {
		const geometry = getAnimatedFlowerGeometry();

		expect(geometry.size).toBe(ANIMATED_FLOWER_BASE_SIZE);
		expect(geometry.petalSize).toBe(ANIMATED_FLOWER_BASE_PETAL_SIZE);
		expect(geometry.petalDistance).toBe(ANIMATED_FLOWER_BASE_PETAL_DISTANCE);
		expect(geometry.petals).toHaveLength(9);
	});

	test("scales the complete geometry proportionally", () => {
		const compactSize = 190;
		const scale = compactSize / ANIMATED_FLOWER_BASE_SIZE;
		const canonical = getAnimatedFlowerGeometry();
		const compact = getAnimatedFlowerGeometry(compactSize);

		expect(compact.center).toBeCloseTo(canonical.center * scale);
		expect(compact.petalSize).toBeCloseTo(canonical.petalSize * scale);
		expect(compact.petalDistance).toBeCloseTo(canonical.petalDistance * scale);
		for (const [index, petal] of compact.petals.entries()) {
			expect(petal.cx).toBeCloseTo(canonical.petals[index].cx * scale);
			expect(petal.cy).toBeCloseTo(canonical.petals[index].cy * scale);
		}
	});

	test.each([
		ANIMATED_FLOWER_BASE_SIZE,
		190,
	])("keeps the expanded flower overlapping and inside size %i", (size) => {
		const geometry = getAnimatedFlowerGeometry(size);
		const petalRadius = geometry.petalSize / 2;

		expect(geometry.petalDistance).toBeLessThan(petalRadius);
		for (const petal of geometry.petals) {
			expect(petal.cx - petalRadius).toBeGreaterThanOrEqual(0);
			expect(petal.cx + petalRadius).toBeLessThanOrEqual(size);
			expect(petal.cy - petalRadius).toBeGreaterThanOrEqual(0);
			expect(petal.cy + petalRadius).toBeLessThanOrEqual(size);
		}
	});
});
