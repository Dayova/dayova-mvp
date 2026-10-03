import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import type { ProvidedContext } from "vitest";
import type {
	ExpoConfigKey,
	ExpoConfigSnapshot,
	ExpoConfigSnapshots,
	ExpoConfigType,
	ExpoConfigVariant,
} from "./expo-config-contract";
import { expoConfigKey } from "./expo-config-contract";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const CONFIG_CONTRACT_TIMEOUT_MS = 60_000;
const CONFIG_CONTRACT_MAX_BUFFER_BYTES = 20 * 1024 * 1024;
const expoCliPath = require.resolve("expo/bin/cli");

const contracts: Array<{
	variant: ExpoConfigVariant;
	type: ExpoConfigType;
}> = [
	{ variant: "production", type: "public" },
	{ variant: "production", type: "introspect" },
	{ variant: "development", type: "introspect" },
];

const runConfigContract = async (
	label: string,
	args: string[],
	env: Partial<NodeJS.ProcessEnv>,
) => {
	const startedAt = performance.now();
	const { stdout } = await execFileAsync(process.execPath, args, {
		cwd: process.cwd(),
		encoding: "utf8",
		env: {
			...process.env,
			JITI_REBUILD_FS_CACHE: "true",
			...env,
		},
		killSignal: "SIGTERM",
		maxBuffer: CONFIG_CONTRACT_MAX_BUFFER_BYTES,
		timeout: CONFIG_CONTRACT_TIMEOUT_MS,
		windowsHide: true,
	});
	const durationMs = Math.round(performance.now() - startedAt);
	console.log(`[expo-config-contract] resolved ${label} in ${durationMs}ms`);
	return stdout;
};

type GlobalSetupProject = {
	provide: <T extends keyof ProvidedContext & string>(
		key: T,
		value: ProvidedContext[T],
	) => void;
	onTestsRerun: (callback: () => Promise<void>) => void;
};

const provideConfigContracts = async (project: GlobalSetupProject) => {
	const snapshots = {} as ExpoConfigSnapshots;
	for (const contract of contracts) {
		const key: ExpoConfigKey = expoConfigKey(contract.variant, contract.type);
		const stdout = await runConfigContract(
			key,
			[expoCliPath, "config", "--type", contract.type, "--json"],
			{ APP_VARIANT: contract.variant },
		);
		snapshots[key] = JSON.parse(stdout) as ExpoConfigSnapshot;
	}
	const watchmanOutput = await runConfigContract(
		"metro:watchman-opt-in",
		[
			"-e",
			'const config = require("./metro.config.js"); process.stdout.write(JSON.stringify(config.resolver.useWatchman));',
		],
		{
			APP_VARIANT: "development",
			DAYOVA_METRO_USE_WATCHMAN: "true",
			NODE_ENV: "test",
		},
	);
	// Expo plugins may log before the final JSON value.
	const useWatchman = JSON.parse(
		watchmanOutput.trim().split(/\r?\n/).at(-1) ?? "",
	);
	project.provide("expoConfigSnapshots", snapshots);
	project.provide("metroWatchmanOptIn", useWatchman);
};

export default async function setup(project: GlobalSetupProject) {
	await provideConfigContracts(project);
	project.onTestsRerun(() => provideConfigContracts(project));
}
