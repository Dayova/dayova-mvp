import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createReport } from "./ota-safety.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const platforms = ["ios", "android"];

export function verifyChannel(response) {
	const channel = response.currentPage;
	const mapping = JSON.parse(channel?.branchMapping ?? "null");
	const target = channel?.updateBranches?.find((b) => b.name === "production");
	if (
		channel?.name !== "production" ||
		channel.isPaused !== false ||
		!target ||
		mapping?.version !== 0 ||
		mapping.data?.length !== 1 ||
		mapping.data[0].branchId !== target.id ||
		mapping.data[0].branchMappingLogic !== "true"
	) {
		throw new Error(
			"Production channel must be active and map exclusively to branch production; refusing to change the mapping.",
		);
	}
}

export function verifyPublication(updates, sourceSha, runtimeVersion) {
	if (!Array.isArray(updates) || updates.length !== 2) {
		throw new Error(
			"Publication did not return exactly two updates; inspect EAS before retrying.",
		);
	}
	for (const platform of platforms) {
		const update = updates.find((u) => u.platform === platform);
		if (
			!update?.id ||
			!update.group ||
			update.runtimeVersion !== runtimeVersion ||
			update.gitCommitHash !== sourceSha ||
			update.branch !== "production"
		) {
			throw new Error(
				`Missing or unexpected ${platform} publication provenance; inspect EAS before retrying.`,
			);
		}
	}
	if (updates[0].group !== updates[1].group) {
		throw new Error(
			"Platform updates have different groups; inspect EAS before retrying.",
		);
	}
	return updates.map(
		({ id, group, platform, runtimeVersion, gitCommitHash }) => ({
			id,
			group,
			platform,
			runtimeVersion,
			sourceSha: gitCommitHash,
		}),
	);
}

// Keep command execution at one boundary so failure paths can be tested without publishing.
export function publishProductionOta({
	sourceSha,
	runtimeVersion,
	run,
	guard,
	log,
}) {
	const verifySource = () => {
		if (
			!/^[0-9a-f]{40}$/.test(sourceSha ?? "") ||
			run("git", ["rev-parse", "HEAD"]).trim() !== sourceSha ||
			run("git", ["status", "--porcelain"]).trim()
		) {
			throw new Error(
				"Production publication requires the clean, exact reviewed main SHA.",
			);
		}
	};
	const verifyGuard = () => {
		const report = guard();
		if (!report.safe) throw new Error(report.reason);
	};
	verifySource();
	verifyGuard();
	run("expo", ["export", "--platform", "all", "--output-dir", "dist"], false);
	verifySource();
	verifyGuard();
	verifyChannel(
		JSON.parse(run("eas", ["channel:view", "production", "--json"])),
	);
	let raw;
	try {
		raw = run("eas", [
			"update",
			"--branch",
			"production",
			"--environment",
			"production",
			"--platform",
			"all",
			"--input-dir",
			"dist",
			"--skip-bundler",
			"--message",
			`Production OTA from ${sourceSha}`,
			"--json",
			"--non-interactive",
		]);
		// Preserve the server result before validation, including partial/unexpected results.
		log(raw);
		const summary = verifyPublication(
			JSON.parse(raw),
			sourceSha,
			runtimeVersion,
		);
		log(JSON.stringify({ status: "published", updates: summary }));
		return summary;
	} catch (error) {
		if (error.stdout?.length) log(String(error.stdout));
		log(
			`Publication failed or is uncertain for ${sourceSha}. Do not retry automatically. Inspect production update groups and follow release/README.md recovery steps.`,
		);
		throw error;
	}
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	// No single-platform override: app config must validate both platform SDK keys.
	const env = { ...process.env, NODE_ENV: "production" };
	delete env.EAS_BUILD_PLATFORM;
	const run = (command, args, capture = true) => {
		const executable =
			command === "expo"
				? process.execPath
				: command === "eas"
					? "pnpm"
					: command;
		const commandArgs =
			command === "expo"
				? [require.resolve("expo/bin/cli"), ...args]
				: command === "eas"
					? ["dlx", "eas-cli@18.11.0", ...args]
					: args;
		return (
			execFileSync(executable, commandArgs, {
				cwd: root,
				env,
				encoding: "utf8",
				stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
				maxBuffer: 16 * 1024 * 1024,
			}) ?? ""
		);
	};
	try {
		const baseline = JSON.parse(
			readFileSync(
				resolve(root, "release/production-ota-baseline.json"),
				"utf8",
			),
		);
		publishProductionOta({
			sourceSha: process.env.OTA_SOURCE_SHA,
			runtimeVersion: baseline.runtimeVersion,
			run,
			guard: createReport,
			log: console.log,
		});
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
