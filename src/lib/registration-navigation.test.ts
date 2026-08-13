import { describe, expect, test } from "vitest";
import {
	shouldCommitRegistrationEdgeBack,
	shouldEnableRegistrationEdgeBack,
	shouldEnableRegistrationRouteBack,
	shouldHandleRegistrationBack,
} from "./registration-navigation";

describe("shouldHandleRegistrationBack", () => {
	test("leaves the native entry-route gesture active on the first flow step", () => {
		expect(shouldHandleRegistrationBack(0, "flow")).toBe(false);
	});

	test("handles back inside registration after progress or a stage transition", () => {
		expect(shouldHandleRegistrationBack(1, "flow")).toBe(true);
		expect(shouldHandleRegistrationBack(0, "verification")).toBe(true);
		expect(shouldHandleRegistrationBack(0, "creating")).toBe(true);
	});
});

describe("shouldEnableRegistrationRouteBack", () => {
	test("only leaves the native route gesture enabled on the idle entry step", () => {
		expect(shouldEnableRegistrationRouteBack(0, "flow", false)).toBe(true);
		expect(shouldEnableRegistrationRouteBack(1, "flow", false)).toBe(false);
		expect(shouldEnableRegistrationRouteBack(0, "verification", false)).toBe(
			false,
		);
		expect(shouldEnableRegistrationRouteBack(0, "flow", true)).toBe(false);
	});
});

describe("shouldEnableRegistrationEdgeBack", () => {
	test("enables iOS edge back only on conflict-free internal steps", () => {
		const base = {
			activeIndex: 4,
			isBusy: false,
			platform: "ios",
			stage: "flow" as const,
		};

		expect(
			shouldEnableRegistrationEdgeBack({ ...base, stepKind: "text" }),
		).toBe(true);
		expect(
			shouldEnableRegistrationEdgeBack({ ...base, stepKind: "days" }),
		).toBe(true);
		expect(
			shouldEnableRegistrationEdgeBack({ ...base, stepKind: "range" }),
		).toBe(false);
		expect(
			shouldEnableRegistrationEdgeBack({ ...base, stepKind: "intro" }),
		).toBe(false);
		expect(
			shouldEnableRegistrationEdgeBack({ ...base, stepKind: "wheel" }),
		).toBe(true);
		expect(
			shouldEnableRegistrationEdgeBack({
				...base,
				platform: "android",
				stepKind: "text",
			}),
		).toBe(false);
		expect(
			shouldEnableRegistrationEdgeBack({
				...base,
				isBusy: true,
				stepKind: "text",
			}),
		).toBe(false);
		expect(
			shouldEnableRegistrationEdgeBack({
				...base,
				stage: "creating",
				stepKind: "text",
			}),
		).toBe(false);
		expect(
			shouldEnableRegistrationEdgeBack({
				...base,
				stage: "verification",
				stepKind: "text",
			}),
		).toBe(true);
	});
});

describe("shouldCommitRegistrationEdgeBack", () => {
	test("commits deliberate drags and directional flings, not small movements", () => {
		expect(
			shouldCommitRegistrationEdgeBack({
				direction: 1,
				translationX: 76,
				velocityX: 100,
				viewportWidth: 390,
			}),
		).toBe(true);
		expect(
			shouldCommitRegistrationEdgeBack({
				direction: 1,
				translationX: 32,
				velocityX: 900,
				viewportWidth: 390,
			}),
		).toBe(true);
		expect(
			shouldCommitRegistrationEdgeBack({
				direction: 1,
				translationX: 24,
				velocityX: 900,
				viewportWidth: 390,
			}),
		).toBe(false);
		expect(
			shouldCommitRegistrationEdgeBack({
				direction: -1,
				translationX: -76,
				velocityX: -100,
				viewportWidth: 390,
			}),
		).toBe(true);
	});
});
