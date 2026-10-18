import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	updates: {
		isEnabled: true,
		isEmbeddedLaunch: false,
		updateId: "ota-a" as string | null,
		runtimeVersion: "1.0.6",
	},
	application: { nativeApplicationVersion: "1.0.6", nativeBuildVersion: "42" },
	lastUpdate: vi.fn<() => Promise<Date>>(),
	contents: undefined as string | undefined,
	write: vi.fn<(contents: string) => Promise<void>>(),
}));

vi.mock("expo-updates", () => mocks.updates);
vi.mock("expo-application", () => ({
	get nativeApplicationVersion() {
		return mocks.application.nativeApplicationVersion;
	},
	get nativeBuildVersion() {
		return mocks.application.nativeBuildVersion;
	},
	getLastUpdateTimeAsync: mocks.lastUpdate,
}));
vi.mock("expo-file-system", () => ({
	Paths: { document: "file:///documents" },
	File: class {
		get exists() {
			return mocks.contents !== undefined;
		}
		async json() {
			return JSON.parse(mocks.contents ?? "");
		}
		async write(contents: string) {
			await mocks.write(contents);
			mocks.contents = contents;
		}
	},
}));

const launch = async () => {
	vi.resetModules();
	const { getRunningUpdateInstallation } = await import(
		"./running-update-installation"
	);
	return getRunningUpdateInstallation();
};

describe("running update installation", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-18T08:15:00Z"));
		vi.stubEnv("EXPO_OS", "ios");
		mocks.contents = undefined;
		mocks.write.mockReset();
		mocks.write.mockResolvedValue(undefined);
		mocks.lastUpdate.mockReset();
		Object.assign(mocks.updates, {
			isEnabled: true,
			isEmbeddedLaunch: false,
			updateId: "ota-a",
		});
		mocks.application.nativeBuildVersion = "42";
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it("records the running update at startup and preserves it across restarts", async () => {
		const first = await launch();
		vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
		const { getRunningUpdateInstallation } = await import(
			"./running-update-installation"
		);
		expect(await getRunningUpdateInstallation()).toEqual(first);
		expect(await launch()).toEqual({
			date: new Date("2026-10-18T08:15:00Z"),
			kind: "first-launch",
		});
		expect(mocks.write).toHaveBeenCalledTimes(1);
	});

	it("records a new OTA separately and retains the original date after rollback", async () => {
		const original = await launch();
		vi.setSystemTime(new Date("2026-10-19T10:00:00Z"));
		mocks.updates.updateId = "ota-b";
		expect(await launch()).toEqual({
			date: new Date("2026-10-19T10:00:00Z"),
			kind: "first-launch",
		});
		mocks.updates.updateId = "ota-a";
		expect(await launch()).toEqual(original);
	});

	it("recognizes a new native build even if its OTA ID is unchanged", async () => {
		await launch();
		mocks.application.nativeBuildVersion = "43";
		vi.setSystemTime(new Date("2026-10-19T10:00:00Z"));
		expect((await launch())?.date.toISOString()).toBe(
			"2026-10-19T10:00:00.000Z",
		);
	});

	it("uses the OS installation date for an Android app bundle", async () => {
		vi.stubEnv("EXPO_OS", "android");
		mocks.updates.isEmbeddedLaunch = true;
		mocks.lastUpdate.mockResolvedValue(new Date("2026-10-16T11:00:00Z"));
		expect(await launch()).toEqual({
			date: new Date("2026-10-16T11:00:00Z"),
			kind: "installation",
		});
		expect(mocks.write).not.toHaveBeenCalled();
	});

	it("uses the OTA's first launch instead of Android's older binary installation", async () => {
		vi.stubEnv("EXPO_OS", "android");
		expect((await launch())?.kind).toBe("first-launch");
		expect(mocks.lastUpdate).not.toHaveBeenCalled();
	});

	it("falls back to first launch when the Android installation date fails", async () => {
		vi.stubEnv("EXPO_OS", "android");
		mocks.updates.isEmbeddedLaunch = true;
		mocks.lastUpdate.mockRejectedValue(new Error("OS unavailable"));
		expect((await launch())?.kind).toBe("first-launch");
	});

	it.each([
		"invalid JSON",
		'{"ota-a":"invalid date"}',
	])("keeps an unreadable history unavailable instead of inventing a date: %s", async (contents) => {
		mocks.contents = contents;
		expect(await launch()).toBeNull();
		expect(mocks.write).not.toHaveBeenCalled();
	});

	it("returns unavailable when the first launch cannot be persisted", async () => {
		mocks.write.mockRejectedValue(new Error("Storage unavailable"));
		expect(await launch()).toBeNull();
	});

	it("does not record development launches or web sessions", async () => {
		mocks.updates.isEnabled = false;
		expect(await launch()).toBeNull();
		mocks.updates.isEnabled = true;
		vi.stubEnv("EXPO_OS", "web");
		expect(await launch()).toBeNull();
		expect(mocks.write).not.toHaveBeenCalled();
	});
});
