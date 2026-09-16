import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const expoCliPath = require.resolve("expo/bin/cli");
const baselinePath = resolve(
	projectRoot,
	"release/production-ota-baseline.json",
);
const platforms = ["ios", "android"];
const fingerprintEnvironmentVariables = {
	ios: "OTA_IOS_FINGERPRINT",
	android: "OTA_ANDROID_FINGERPRINT",
};
const isNonEmptyString = (value) =>
	typeof value === "string" && value.trim().length > 0;
const isUuid = (value) =>
	isNonEmptyString(value) &&
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
		value,
	);
const isFullGitSha = (value) =>
	isNonEmptyString(value) && /^[0-9a-f]{40}$/i.test(value);
const isFingerprintHash = (value) =>
	isNonEmptyString(value) && /^[0-9a-f]{40}$/i.test(value);
const isBuildVersion = (value) =>
	isNonEmptyString(value) && /^\d+$/.test(value);

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

	if (baseline.schemaVersion !== 2) {
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

	if (baseline.appVersion !== config.version) {
		errors.push(
			`app version ${config.version ?? "missing"} does not match baseline app version ${baseline.appVersion ?? "missing"}`,
		);
	}
	if (baseline.sdkVersion !== config.sdkVersion) {
		errors.push(
			`Expo SDK ${config.sdkVersion ?? "missing"} does not match baseline SDK ${baseline.sdkVersion ?? "missing"}`,
		);
	}

	for (const platform of platforms) {
		const platformBaseline = baseline.platforms?.[platform];
		const currentRuntimeVersion = getRuntimeVersion(config, platform);
		const currentAppIdentifier =
			platform === "ios"
				? config.ios?.bundleIdentifier
				: config.android?.package;

		if (!platformBaseline) {
			errors.push(`${platform} has no distributed-build baseline`);
			continue;
		}

		if (platformBaseline.distribution?.status !== "verified") {
			errors.push(
				`${platform} baseline build ${platformBaseline.buildVersion} distribution is not verified`,
			);
		}
		if (!isNonEmptyString(platformBaseline.distribution?.audience)) {
			errors.push(`${platform} distribution audience must be recorded`);
		}
		if (!isNonEmptyString(platformBaseline.distribution?.evidence)) {
			errors.push(`${platform} distribution evidence must be recorded`);
		}
		if (platformBaseline.embeddedUpdate?.status !== "verified") {
			errors.push(
				`${platform} baseline build ${platformBaseline.buildVersion} embedded update is not verified`,
			);
		}
		if (!isUuid(platformBaseline.embeddedUpdate?.updateId)) {
			errors.push(`${platform} embedded updateId must be a UUID`);
		}
		if (!isNonEmptyString(platformBaseline.embeddedUpdate?.evidence)) {
			errors.push(`${platform} embedded update evidence must be recorded`);
		}

		if (!isUuid(platformBaseline.buildId)) {
			errors.push(`${platform} baseline buildId must be a UUID`);
		}
		if (!isBuildVersion(platformBaseline.buildVersion)) {
			errors.push(`${platform} baseline buildVersion must be numeric`);
		}
		if (!isFullGitSha(platformBaseline.sourceSha)) {
			errors.push(`${platform} baseline sourceSha must be a full Git SHA`);
		}

		if (currentRuntimeVersion !== baseline.runtimeVersion) {
			errors.push(
				`${platform} runtime ${currentRuntimeVersion ?? "missing"} does not match baseline runtime ${baseline.runtimeVersion}`,
			);
		}
		if (platformBaseline.runtimeVersion !== baseline.runtimeVersion) {
			errors.push(
				`${platform} build runtime ${platformBaseline.runtimeVersion ?? "missing"} does not match baseline runtime ${baseline.runtimeVersion}`,
			);
		}
		if (platformBaseline.appVersion !== baseline.appVersion) {
			errors.push(
				`${platform} build app version ${platformBaseline.appVersion ?? "missing"} does not match baseline app version ${baseline.appVersion}`,
			);
		}
		if (platformBaseline.sdkVersion !== baseline.sdkVersion) {
			errors.push(
				`${platform} build SDK ${platformBaseline.sdkVersion ?? "missing"} does not match baseline SDK ${baseline.sdkVersion}`,
			);
		}
		if (platformBaseline.appIdentifier !== currentAppIdentifier) {
			errors.push(
				`${platform} build identifier ${platformBaseline.appIdentifier ?? "missing"} does not match production identifier ${currentAppIdentifier ?? "missing"}`,
			);
		}
		if (platformBaseline.channel !== baseline.channel) {
			errors.push(
				`${platform} build channel ${platformBaseline.channel ?? "missing"} does not match baseline channel ${baseline.channel}`,
			);
		}
		if (
			platformBaseline.embeddedUpdate?.runtimeVersion !==
			platformBaseline.runtimeVersion
		) {
			errors.push(
				`${platform} embedded update runtime ${platformBaseline.embeddedUpdate?.runtimeVersion ?? "missing"} does not match build runtime ${platformBaseline.runtimeVersion ?? "missing"}`,
			);
		}

		const distributedFingerprint = platformBaseline.fingerprint;
		const currentFingerprint = fingerprints[platform];
		const hasDistributedFingerprint = isFingerprintHash(distributedFingerprint);
		const hasCurrentFingerprint = isFingerprintHash(currentFingerprint);

		if (!hasDistributedFingerprint) {
			errors.push(
				`${platform} baseline fingerprint must be a 40-character hash`,
			);
		}
		if (!hasCurrentFingerprint) {
			errors.push(
				`${platform} current fingerprint must be a 40-character hash`,
			);
		}

		if (
			hasDistributedFingerprint &&
			hasCurrentFingerprint &&
			currentFingerprint !== distributedFingerprint
		) {
			errors.push(
				`${platform} fingerprint ${currentFingerprint} does not match distributed build ${platformBaseline.buildVersion} fingerprint ${distributedFingerprint}`,
			);
		}
	}

	const baselineSummary = platforms
		.map((platform) => {
			const entry = baseline.platforms?.[platform];
			const abbreviatedSourceSha = isFullGitSha(entry?.sourceSha)
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
		failureKind: errors.length === 0 ? null : "compatibility",
		reason:
			errors.length === 0
				? "Production manifest and phase-equivalent native fingerprints match the verified distributed binaries."
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
export const readWorkflowFingerprints = () =>
	Object.fromEntries(
		platforms.map((platform) => {
			const variableName = fingerprintEnvironmentVariables[platform];
			const fingerprint = process.env[variableName];

			if (!isNonEmptyString(fingerprint)) {
				throw new Error(
					`${variableName} is missing; production fingerprints must come from the EAS fingerprint job using the production environment`,
				);
			}

			return [platform, fingerprint.trim()];
		}),
	);

export const createReport = () => {
	if (process.env.APP_VARIANT !== "production") {
		return {
			safe: false,
			failureKind: "preflight",
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
		const config = runJsonCommand(process.execPath, [
			expoCliPath,
			"config",
			"--type",
			"public",
			"--json",
		]);
		const fingerprints = readWorkflowFingerprints();
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
			failureKind: "preflight",
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
