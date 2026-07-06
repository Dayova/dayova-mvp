import { describe, expect, test, vi } from "vitest";
import { goBackToReturnOrReplace } from "./navigation-actions";

type TestRouter = Parameters<typeof goBackToReturnOrReplace>[0];

const createRouter = (canGoBack: boolean): TestRouter => ({
	back: vi.fn(),
	canGoBack: vi.fn(() => canGoBack),
	replace: vi.fn(),
});

describe("goBackToReturnOrReplace", () => {
	test("uses the explicit return route when one is provided", () => {
		const router = createRouter(true);

		goBackToReturnOrReplace(router, "/settings", "/learning-plans/abc/review");

		expect(router.replace).toHaveBeenCalledWith("/learning-plans/abc/review");
		expect(router.back).not.toHaveBeenCalled();
	});

	test("uses the native back action when the stack can go back", () => {
		const router = createRouter(true);

		goBackToReturnOrReplace(router, "/settings");

		expect(router.back).toHaveBeenCalledOnce();
		expect(router.replace).not.toHaveBeenCalled();
	});

	test("replaces with the fallback when there is no back stack", () => {
		const router = createRouter(false);

		goBackToReturnOrReplace(router, "/settings");

		expect(router.replace).toHaveBeenCalledWith("/settings");
		expect(router.back).not.toHaveBeenCalled();
	});
});
