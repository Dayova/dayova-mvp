const {
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} = require("node:fs");
const { dirname, join, resolve } = require("node:path");

const GRADLE_DAEMON_JVM_PROPERTIES = [
	"# This file is managed by Dayova's Android preparation script.",
	"toolchainVersion=17",
	"",
].join("\n");

function prepareAndroidGradleJvm({
	projectRoot = process.cwd(),
	requireNativeProject = true,
} = {}) {
	const androidRoot = join(resolve(projectRoot), "android");
	const propertiesPath = join(
		androidRoot,
		"gradle",
		"gradle-daemon-jvm.properties",
	);

	if (requireNativeProject && !existsSync(join(androidRoot, "gradlew"))) {
		return { status: "absent", propertiesPath };
	}

	const previousContents = existsSync(propertiesPath)
		? readFileSync(propertiesPath, "utf8")
		: undefined;

	if (previousContents === GRADLE_DAEMON_JVM_PROPERTIES) {
		return { status: "current", propertiesPath };
	}

	mkdirSync(dirname(propertiesPath), { recursive: true });
	writeFileSync(propertiesPath, GRADLE_DAEMON_JVM_PROPERTIES, "utf8");

	return {
		status: previousContents === undefined ? "created" : "updated",
		propertiesPath,
	};
}

if (require.main === module) {
	const result = prepareAndroidGradleJvm();
	if (result.status !== "current" && result.status !== "absent") {
		console.log(
			`[android-gradle] ${result.status === "created" ? "Created" : "Updated"} the JDK 17 daemon criterion.`,
		);
	}
}

module.exports = {
	GRADLE_DAEMON_JVM_PROPERTIES,
	prepareAndroidGradleJvm,
};
