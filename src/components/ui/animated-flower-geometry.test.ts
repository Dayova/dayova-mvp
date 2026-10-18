import { describe, expect, test } from "vitest";
import {
	getAnimatedFlowerGeometry,
	getAnimatedFlowerPetalPosition,
} from "./animated-flower-geometry";

describe("animated flower geometry", () => {
	test.each([
		[-1, 10],
		[0, 10],
		[0.5, 20],
		[1, 30],
		[2, 30],
	])("interpolates and clamps petal progress %s", (progress, cx) => {
		expect(
			getAnimatedFlowerPetalPosition(
				{ id: "petal", cx: 30, cy: 10 },
				progress,
				10,
			),
		).toEqual({ cx, cy: 10 });
	});
	test.each([
		190, 360,
	])("keeps an overlapping flower inside its %s-point canvas", (size) => {
		const geometry = getAnimatedFlowerGeometry(size);
		expect(geometry.petals.length).toBeGreaterThan(0);
		const radius = geometry.petalSize / 2;
		expect(geometry.petalDistance).toBeLessThan(radius);
		for (const petal of geometry.petals) {
			expect(petal.cx - radius).toBeGreaterThanOrEqual(0);
			expect(petal.cx + radius).toBeLessThanOrEqual(size);
			expect(petal.cy - radius).toBeGreaterThanOrEqual(0);
			expect(petal.cy + radius).toBeLessThanOrEqual(size);
		}
	});
});
