const { existsSync, readFileSync, statSync, unlinkSync } = require("node:fs");
const { join, resolve } = require("node:path");

function invalidateSentinel(sentinelPath) {
	try {
		unlinkSync(sentinelPath);
	} catch (error) {
		if (error?.code !== "ENOENT") {
			throw error;
		}
	}
}

function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDirectory(sourceDirectory) {
	try {
		return statSync(sourceDirectory).isDirectory();
	} catch {
		return false;
	}
}

function prepareAndroidAutolinkingCache({ projectRoot = process.cwd() } = {}) {
	const cacheDirectory = join(
		resolve(projectRoot),
		"android",
		"build",
		"generated",
		"autolinking",
	);
	const configPath = join(cacheDirectory, "autolinking.json");
	const sentinelPath = join(cacheDirectory, "package.json.sha");

	if (!existsSync(configPath)) {
		return { status: "absent", missingSourceDirectories: [] };
	}

	let config;
	try {
		config = JSON.parse(readFileSync(configPath, "utf8"));
	} catch {
		invalidateSentinel(sentinelPath);
		return { status: "invalidated", missingSourceDirectories: [] };
	}

	if (
		!isObject(config) ||
		(config.dependencies !== undefined && !isObject(config.dependencies))
	) {
		invalidateSentinel(sentinelPath);
		return { status: "invalidated", missingSourceDirectories: [] };
	}

	const dependencies = config.dependencies ?? {};
	const missingSourceDirectories = [
		...new Set(
			Object.values(dependencies)
				.map((dependency) => dependency?.platforms?.android?.sourceDir)
				.filter(
					(sourceDirectory) =>
						typeof sourceDirectory === "string" &&
						!isDirectory(sourceDirectory),
				),
		),
	].sort();

	if (missingSourceDirectories.length === 0) {
		return { status: "fresh", missingSourceDirectories };
	}

	invalidateSentinel(sentinelPath);
	return { status: "invalidated", missingSourceDirectories };
}

if (require.main === module) {
	const result = prepareAndroidAutolinkingCache();
	if (result.status === "invalidated") {
		const detail =
			result.missingSourceDirectories.length > 0
				? ` (${result.missingSourceDirectories.length} missing native source directories)`
				: " (generated JSON was unreadable)";
		console.log(
			`[android-autolinking] Invalidated stale React Native cache${detail}.`,
		);
	}
}

module.exports = { prepareAndroidAutolinkingCache };
