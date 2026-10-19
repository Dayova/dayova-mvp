import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const manifestName = "dayova-export.json";
const digest = (value) => createHash("sha256").update(value).digest("hex");

export function productionExportContext({ sourceSha, runtimeVersion, env }) {
	return {
		sourceSha,
		runtimeVersion,
		iosFingerprint: env.OTA_IOS_FINGERPRINT,
		androidFingerprint: env.OTA_ANDROID_FINGERPRINT,
		environmentDigest: digest(
			JSON.stringify(
				Object.entries(env)
					.filter(
						([key]) => key.startsWith("EXPO_PUBLIC_") || key === "APP_VARIANT",
					)
					.sort(([a], [b]) => a.localeCompare(b)),
			),
		),
	};
}

function files(directory, prefix = "") {
	return readdirSync(join(directory, prefix))
		.sort()
		.flatMap((name) => {
			const relativePath = prefix ? `${prefix}/${name}` : name;
			const path = join(directory, relativePath);
			const stat = lstatSync(path);
			if (stat.isSymbolicLink())
				throw new Error("Export artifacts must not contain symbolic links");
			if (stat.isDirectory()) return files(directory, relativePath);
			if (!stat.isFile())
				throw new Error("Export artifacts must contain regular files");
			return relativePath === manifestName
				? []
				: [[relativePath, digest(readFileSync(path))]];
		});
}

export function recordProductionExport(directory, context) {
	if (
		!/^[a-f0-9]{40}$/.test(context.sourceSha ?? "") ||
		!context.runtimeVersion ||
		!/^[a-f0-9]{40}$/.test(context.iosFingerprint ?? "") ||
		!/^[a-f0-9]{40}$/.test(context.androidFingerprint ?? "")
	) {
		throw new Error(
			"A production export requires source, runtime and both native fingerprints",
		);
	}
	const metadata = JSON.parse(
		readFileSync(join(directory, "metadata.json"), "utf8"),
	);
	if (
		!metadata.fileMetadata?.ios?.bundle ||
		!metadata.fileMetadata?.android?.bundle
	)
		throw new Error("The export must contain both platform bundles");
	const entries = files(directory);
	for (const platform of ["ios", "android"]) {
		if (
			!entries.some(([path]) => path === metadata.fileMetadata[platform].bundle)
		)
			throw new Error(`Missing ${platform} export bundle`);
	}
	writeFileSync(
		join(directory, manifestName),
		JSON.stringify({ schemaVersion: 1, ...context, files: entries }, null, 2),
	);
}

export function verifyProductionExport(directory, expected) {
	const manifest = JSON.parse(
		readFileSync(join(directory, manifestName), "utf8"),
	);
	if (
		manifest.schemaVersion !== 1 ||
		Object.entries(expected).some(
			([key, value]) => !value || manifest[key] !== value,
		)
	)
		throw new Error(
			"Export source, runtime, environment or fingerprints differ from the publication job",
		);
	if (JSON.stringify(manifest.files) !== JSON.stringify(files(directory)))
		throw new Error("Export artifact integrity check failed");
	return directory;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const require = createRequire(import.meta.url);
	const env = { ...process.env, NODE_ENV: "production" };
	delete env.EAS_BUILD_PLATFORM;
	const directory = resolve("dist/production");
	const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf8",
	}).trim();
	const start = performance.now();
	execFileSync(
		process.execPath,
		[
			require.resolve("expo/bin/cli"),
			"export",
			"--platform",
			"all",
			"--output-dir",
			directory,
		],
		{ env, stdio: "inherit" },
	);
	const config = JSON.parse(
		execFileSync(
			process.execPath,
			[require.resolve("expo/bin/cli"), "config", "--json"],
			{ env, encoding: "utf8" },
		),
	);
	const context = productionExportContext({
		sourceSha,
		runtimeVersion: config.version,
		env,
	});
	recordProductionExport(directory, context);
	verifyProductionExport(directory, context);
	console.log(
		`DAYOVA_CI_EXPORT ${JSON.stringify({ sourceSha, seconds: (performance.now() - start) / 1000, platforms: ["ios", "android"] })}`,
	);
}
