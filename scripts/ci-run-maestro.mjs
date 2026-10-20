import { spawnSync } from "node:child_process";
import {
	closeSync,
	mkdirSync,
	openSync,
	writeFileSync,
	writeSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { sanitizeMaestroArtifacts } from "./ci-sanitize-maestro.mjs";

// External process execution is the native-tool boundary; artifacts and exit
// status stay under this consumer's control until redaction has completed.
export function runDeviceSmoke(
	appPath,
	flow = "full",
	{
		env = process.env,
		execute = spawnSync,
		directory = join(process.cwd(), ".maestro/artifacts/device/.maestro/tests"),
	} = {},
) {
	const platform = {
		"com.dayova.dev": "android",
		"de.dayova.app-dev": "ios",
	}[env.MAESTRO_APP_ID];
	const flows = {
		full: [
			".maestro/ci/unauthenticated.yaml",
			".maestro/ci/authenticated.yaml",
		],
		authenticated: [".maestro/ci/authenticated.yaml"],
		failure: [".maestro/ci/failure-probe.yaml"],
	}[flow];
	if (
		!appPath ||
		!platform ||
		!flows ||
		!env.MAESTRO_CI_EMAIL?.includes("+clerk_test@") ||
		!env.MAESTRO_CI_PASSWORD
	)
		throw new Error(
			"Device smoke requires a test app, synthetic credentials and a known flow",
		);
	mkdirSync(directory, { recursive: true });
	const run = (name, command, args, timeout = 60_000) => {
		const fd = openSync(join(directory, `${name}.log`), "w");
		try {
			const result = execute(command, args, {
				env,
				stdio: ["ignore", fd, fd],
				timeout,
			});
			if (result.error) writeSync(fd, result.error.message);
			return result.status ?? 1;
		} finally {
			closeSync(fd);
		}
	};
	let exitCode = 1;
	const started = Date.now();
	try {
		const install =
			platform === "ios"
				? run("install", "xcrun", ["simctl", "install", "booted", appPath])
				: run("install", "adb", ["install", "-r", appPath]);
		if (install !== 0) throw new Error("Test app installation failed");
		if (
			run("prepare", process.execPath, ["scripts/ci-prepare-maestro.mjs"]) !== 0
		)
			throw new Error("Device test preparation failed");
		exitCode = run(
			"maestro",
			"maestro",
			[
				"--platform",
				platform,
				"test",
				"-e",
				`MAESTRO_APP_ID=${env.MAESTRO_APP_ID}`,
				"-e",
				`MAESTRO_CI_EMAIL=${env.MAESTRO_CI_EMAIL}`,
				"-e",
				`MAESTRO_CI_PASSWORD=${env.MAESTRO_CI_PASSWORD}`,
				"--format",
				"junit",
				"--output",
				join(directory, "report.xml"),
				"--test-output-dir",
				directory,
				"--debug-output",
				join(directory, "debug"),
				...flows,
			],
			10 * 60_000,
		);
	} finally {
		try {
			const status =
				platform === "ios"
					? run("device", "xcrun", [
							"simctl",
							"spawn",
							"booted",
							"log",
							"show",
							"--style",
							"compact",
							"--last",
							"15m",
							"--info",
							"--debug",
							"--predicate",
							'process == "Dayova"',
						])
					: run("device", "adb", ["logcat", "-d", "-v", "threadtime"]);
			if (status !== 0) exitCode = 1;
		} finally {
			// The uploader runs only after this function returns. No provider step
			// collects an unsanitized system archive after this boundary.
			const redaction = sanitizeMaestroArtifacts(directory, env);
			writeFileSync(
				join(directory, "result.json"),
				JSON.stringify({
					exitCode,
					durationMs: Date.now() - started,
					redaction,
				}),
			);
		}
	}
	return exitCode;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	process.exitCode = runDeviceSmoke(process.argv[2], process.argv[3]);
}
