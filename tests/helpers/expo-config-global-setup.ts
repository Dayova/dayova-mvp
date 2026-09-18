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
const EXPO_CONFIG_TIMEOUT_MS = 60_000;
const EXPO_CONFIG_MAX_BUFFER_BYTES = 20 * 1024 * 1024;
const expoCliPath = require.resolve("expo/bin/cli");

const contracts: Array<{
	variant: ExpoConfigVariant;
	type: ExpoConfigType;
}> = [
	{ variant: "production", type: "public" },
	{ variant: "production", type: "introspect" },
	{ variant: "development", type: "introspect" },
];

const resolveExpoConfig = async (
	variant: ExpoConfigVariant,
	type: ExpoConfigType,
) => {
	const startedAt = performance.now();
	const { stdout } = await execFileAsync(
		process.execPath,
		[expoCliPath, "config", "--type", type, "--json"],
		{
			cwd: process.cwd(),
			encoding: "utf8",
			env: {
				...process.env,
				APP_VARIANT: variant,
				JITI_REBUILD_FS_CACHE: "true",
			},
			killSignal: "SIGTERM",
			maxBuffer: EXPO_CONFIG_MAX_BUFFER_BYTES,
			timeout: EXPO_CONFIG_TIMEOUT_MS,
			windowsHide: true,
		},
	);
	const durationMs = Math.round(performance.now() - startedAt);
	console.log(
		`[expo-config-contract] resolved ${variant}:${type} in ${durationMs}ms`,
	);
	return JSON.parse(stdout) as ExpoConfigSnapshot;
};

type GlobalSetupProject = {
	provide: <T extends keyof ProvidedContext & string>(
		key: T,
		value: ProvidedContext[T],
	) => void;
};

export default async function setup(project: GlobalSetupProject) {
	const snapshots = {} as ExpoConfigSnapshots;
	for (const contract of contracts) {
		const key: ExpoConfigKey = expoConfigKey(contract.variant, contract.type);
		snapshots[key] = await resolveExpoConfig(contract.variant, contract.type);
	}
	project.provide("expoConfigSnapshots", snapshots);
}
