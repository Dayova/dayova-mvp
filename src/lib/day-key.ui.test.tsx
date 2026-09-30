import { afterEach, expect, jest, test } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import { getDayKey, useCurrentLocalDay } from "./day-key";

afterEach(() => {
	jest.useRealTimers();
});

test("refreshes the dashboard's day across midnight and schedules the next day", async () => {
	jest.useFakeTimers();
	jest.setSystemTime(new Date(2026, 8, 29, 23, 59, 59));
	const { result, unmount } = await renderHook(useCurrentLocalDay);
	expect(getDayKey(result.current)).toBe("2026-09-29");
	await act(async () => jest.advanceTimersByTime(2000));
	expect(getDayKey(result.current)).toBe("2026-09-30");
	await act(async () => jest.advanceTimersByTime(24 * 60 * 60 * 1000));
	expect(getDayKey(result.current)).toBe("2026-10-01");
	const clearTimeoutSpy = jest.spyOn(globalThis, "clearTimeout");
	await unmount();
	expect(clearTimeoutSpy).toHaveBeenCalled();
	clearTimeoutSpy.mockRestore();
});
