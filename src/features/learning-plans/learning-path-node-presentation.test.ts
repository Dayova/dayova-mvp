import { describe, expect, test } from "vitest";
import {
	getLearningPathNodePresentation,
	LEARNING_PATH_BREATHING,
} from "./learning-path-node-presentation";

describe("getLearningPathNodePresentation", () => {
	test("completed sessions use the Duolingo check treatment and only show a solid halo when selected", () => {
		expect(
			getLearningPathNodePresentation({
				phase: "practice",
				selected: false,
				state: "completed",
			}),
		).toEqual({
			halo: "none",
			icon: "check",
			motion: "still",
			tone: "blue",
		});

		expect(
			getLearningPathNodePresentation({
				phase: "theory",
				selected: true,
				state: "completed",
			}),
		).toEqual({
			halo: "solid",
			icon: "check",
			motion: "still",
			tone: "blue",
		});
	});

	test("unfinished sessions stay gray and only show a continuous halo when selected", () => {
		expect([
			getLearningPathNodePresentation({
				phase: "theory",
				selected: true,
				state: "current",
			}),
			getLearningPathNodePresentation({
				phase: "practice",
				selected: false,
				state: "current",
			}),
			getLearningPathNodePresentation({
				phase: "rehearsal",
				selected: false,
				state: "current",
			}),
		]).toEqual([
			{ halo: "solid", icon: "note", motion: "breathe", tone: "gray" },
			{
				halo: "none",
				icon: "dumbbell",
				motion: "breathe",
				tone: "gray",
			},
			{
				halo: "none",
				icon: "repeat",
				motion: "breathe",
				tone: "gray",
			},
		]);
	});

	test("locked sessions keep their phase icons on compact gray coins and use the same selected halo", () => {
		expect([
			getLearningPathNodePresentation({
				phase: "theory",
				selected: false,
				state: "locked",
			}),
			getLearningPathNodePresentation({
				phase: "practice",
				selected: true,
				state: "locked",
			}),
			getLearningPathNodePresentation({
				phase: "rehearsal",
				selected: false,
				state: "locked",
			}),
		]).toEqual([
			{ halo: "none", icon: "note", motion: "still", tone: "gray" },
			{ halo: "solid", icon: "dumbbell", motion: "still", tone: "gray" },
			{ halo: "none", icon: "repeat", motion: "still", tone: "gray" },
		]);
	});

	test("the breathing treatment visibly shrinks and grows once per two-second cycle", () => {
		expect(LEARNING_PATH_BREATHING).toEqual({
			halfCycleMs: 1000,
			maxScale: 1.06,
			minScale: 0.96,
		});
	});
});
