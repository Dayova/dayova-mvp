import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	OnTestsRerunHandler,
	TestProject,
	TestSpecification,
} from "vitest/node";
import setup from "./helpers/expo-config-global-setup";

const { runChild } = vi.hoisted(() => ({ runChild: vi.fn() }));
let configVersion: string;

// Mock Node's documented promisified subprocess boundary, not the setup logic.
// The real Expo output remains covered by the configuration contract project.
vi.mock("node:child_process", () => ({
	execFile: Object.assign(vi.fn(), {
		[Symbol.for("nodejs.util.promisify.custom")]: runChild,
	}),
}));

const specification = (projectName: string) =>
	({ project: { name: projectName } }) as TestSpecification;

const startSetup = async () => {
	const provided = new Map<string, unknown>();
	let rerun: OnTestsRerunHandler | undefined;
	const project: Pick<TestProject, "name" | "provide" | "onTestsRerun"> = {
		name: "expo-config-contract",
		provide: (key, value) => {
			provided.set(key, value);
		},
		onTestsRerun: (callback) => {
			rerun = callback;
		},
	};
	await setup(project);
	if (!rerun) throw new Error("Setup must register a watch rerun handler");
	runChild.mockClear();
	return { provided, rerun };
};

describe("Expo configuration watch refresh", () => {
	beforeEach(() => {
		configVersion = "1.0.6";
		runChild.mockReset();
		runChild.mockImplementation((_executable: string, args: string[]) =>
			Promise.resolve({
				stdout:
					args[0] === "-e"
						? "true"
						: JSON.stringify({ version: configVersion }),
				stderr: "",
			}),
		);
	});

	it("starts no configuration subprocesses for another project's rerun", async () => {
		const { rerun } = await startSetup();
		await rerun([specification("unit")]);
		expect(runChild).not.toHaveBeenCalled();
	});

	it("publishes fresh configuration results when its contracts rerun with other tests", async () => {
		const { provided, rerun } = await startSetup();
		expect(provided.get("expoConfigSnapshots")).toHaveProperty(
			"production:public.version",
			"1.0.6",
		);
		configVersion = "1.0.7";
		await rerun([specification("unit"), specification("expo-config-contract")]);
		expect(provided.get("expoConfigSnapshots")).toHaveProperty(
			"production:public.version",
			"1.0.7",
		);
	});

	it("fails the refresh when configuration resolution fails", async () => {
		const { rerun } = await startSetup();
		runChild.mockRejectedValueOnce(new Error("Expo configuration failed"));
		await expect(
			rerun([specification("expo-config-contract")]),
		).rejects.toThrow("Expo configuration failed");
	});
});
