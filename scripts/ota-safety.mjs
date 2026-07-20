import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = resolve(
	projectRoot,
	"release/production-ota-baseline.json",
);
const platforms = ["ios", "android"];
const isNonEmptyString = (value) =>
	typeof value === "string" && value.length > 0;

const expectedProductionManifest = {
	iosBundleIdentifier: "de.dayova.app",
	androidPackage: "com.dayova",
	icon: "./assets/dayova-logo.png",
	androidForegroundImage: "./assets/dayova-logo-android-foreground.png",
	splashImage: "./assets/dayova-logo.png",
};

const forbiddenProductionManifestValues = [
	"de.dayova.app-dev",
	"com.dayova.dev",
	"dayova-logo-dev",
];

const getSplashImage = (config) => {
	const splashPlugin = config.plugins?.find(
		(plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
	);

	return Array.isArray(splashPlugin) ? splashPlugin[1]?.image : undefined;
};

const getRuntimeVersion = (config, platform) => {
	const runtimeVersion = config[platform]?.runtimeVersion;

	if (typeof runtimeVersion === "string") return runtimeVersion;
	if (runtimeVersion?.policy === "appVersion") return config.version;

	return undefined;
};

export const validateProductionManifest = (config) => {
	const errors = [];
	const checks = [
		[
			"iOS bundle identifier",
			config.ios?.bundleIdentifier,
			expectedProductionManifest.iosBundleIdentifier,
		],
		[
			"Android package",
			config.android?.package,
			expectedProductionManifest.androidPackage,
		],
		["app icon", config.icon, expectedProductionManifest.icon],
		[
			"Android adaptive icon",
			config.android?.adaptiveIcon?.foregroundImage,
			expectedProductionManifest.androidForegroundImage,
		],
		[
			"splash image",
			getSplashImage(config),
			expectedProductionManifest.splashImage,
		],
	];

	for (const [label, actual, expected] of checks) {
		if (actual !== expected) {
			errors.push(
				`${label} must be ${expected}; received ${actual ?? "missing"}`,
			);
		}
	}

	const serializedConfig = JSON.stringify(config);
	for (const forbiddenValue of forbiddenProductionManifestValues) {
		if (serializedConfig.includes(forbiddenValue)) {
			errors.push(
				`production manifest contains development-only value ${forbiddenValue}`,
			);
		}
	}

	return errors;
};

export const evaluateProductionOta = ({
	appVariant,
	baseline,
	config,
	fingerprints,
	sourceSha,
}) => {
	const errors = [];

	if (appVariant !== "production") {
		errors.push(
			`APP_VARIANT must be production; received ${appVariant ?? "missing"}`,
		);
	}

	if (baseline.schemaVersion !== 1) {
		errors.push(
			`unsupported baseline schema ${baseline.schemaVersion ?? "missing"}`,
		);
	}
	if (baseline.channel !== "production") {
		errors.push(
			`baseline channel must be production; received ${baseline.channel ?? "missing"}`,
		);
	}

	errors.push(...validateProductionManifest(config));

	for (const platform of platforms) {
		const platformBaseline = baseline.platforms?.[platform];
		const currentRuntimeVersion = getRuntimeVersion(config, platform);

		if (!platformBaseline) {
			errors.push(`${platform} has no distributed-build baseline`);
			continue;
		}

		if (platformBaseline.distribution?.status !== "verified") {
			errors.push(
				`${platform} baseline build ${platformBaseline.buildVersion} distribution is not verified`,
			);
		}

		if (!isNonEmptyString(platformBaseline.sourceSha)) {
			errors.push(`${platform} baseline sourceSha must be a non-empty string`);
		}

		if (currentRuntimeVersion !== baseline.runtimeVersion) {
			errors.push(
				`${platform} runtime ${currentRuntimeVersion ?? "missing"} does not match baseline runtime ${baseline.runtimeVersion}`,
			);
		}

		if (fingerprints[platform] !== platformBaseline.fingerprint) {
			errors.push(
				`${platform} fingerprint ${fingerprints[platform] ?? "missing"} does not match distributed build ${platformBaseline.buildVersion} fingerprint ${platformBaseline.fingerprint}`,
			);
		}
	}

	const baselineSummary = platforms
		.map((platform) => {
			const entry = baseline.platforms?.[platform];
			const abbreviatedSourceSha = isNonEmptyString(entry?.sourceSha)
				? entry.sourceSha.slice(0, 7)
				: "invalid";
			return entry
				? `${platform} build ${entry.buildVersion} @ ${abbreviatedSourceSha} (${entry.distribution?.status ?? "unknown"})`
				: `${platform} missing`;
		})
		.join(", ");
	const fingerprintSummary = platforms
		.map((platform) => `${platform} ${fingerprints[platform] ?? "missing"}`)
		.join(", ");

	return {
		safe: errors.length === 0,
		reason:
			errors.length === 0
				? "Production manifest and native fingerprints match the verified distributed binaries."
				: errors.join("; "),
		errors,
		baseline: baselineSummary,
		currentFingerprints: fingerprintSummary,
		sourceSha,
	};
};

const runJsonCommand = (command, args) =>
	JSON.parse(
		execFileSync(command, args, {
			cwd: projectRoot,
			encoding: "utf8",
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
		}),
	);

const createReport = () => {
	if (process.env.APP_VARIANT !== "production") {
		return {
			safe: false,
			reason: `APP_VARIANT must be production; received ${process.env.APP_VARIANT ?? "missing"}`,
			errors: [
				`APP_VARIANT must be production; received ${process.env.APP_VARIANT ?? "missing"}`,
			],
			baseline: "not loaded",
			currentFingerprints: "not generated",
			sourceSha: process.env.GITHUB_SHA,
		};
	}

	try {
		const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
		const config = runJsonCommand("pnpm", [
			"exec",
			"expo",
			"config",
			"--type",
			"public",
			"--json",
		]);
		const fingerprints = Object.fromEntries(
			platforms.map((platform) => [
				platform,
				runJsonCommand("pnpm", [
					"exec",
					"fingerprint",
					"fingerprint:generate",
					"--platform",
					platform,
				]).hash,
			]),
		);
		const sourceSha =
			process.env.GITHUB_SHA ??
			execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: projectRoot,
				encoding: "utf8",
			}).trim();

		return evaluateProductionOta({
			appVariant: process.env.APP_VARIANT,
			baseline,
			config,
			fingerprints,
			sourceSha,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			safe: false,
			reason: `OTA preflight could not be completed: ${message}`,
			errors: [message],
			baseline: "unavailable",
			currentFingerprints: "unavailable",
			sourceSha: process.env.GITHUB_SHA,
		};
	}
};

const isMainModule =
	process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
	const report = createReport();
	const jsonOutput = process.argv.includes("--json");

	if (jsonOutput) {
		process.stdout.write(`${JSON.stringify(report)}\n`);
	} else {
		console.log(
			report.safe ? "Production OTA is safe." : "Production OTA is blocked.",
		);
		console.log(report.reason);
		console.log(`Baseline: ${report.baseline}`);
		console.log(`Current fingerprints: ${report.currentFingerprints}`);
	}

	if (!report.safe) process.exitCode = 1;
}
