const assert = require("node:assert/strict");
const {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { dirname, join } = require("node:path");
const { afterEach, test } = require("node:test");

const {
	GRADLE_DAEMON_JVM_PROPERTIES,
	prepareAndroidGradleJvm,
} = require("./prepare-android-gradle-jvm.cjs");

const fixtureRoots = [];

afterEach(() => {
	for (const root of fixtureRoots.splice(0)) {
		rmSync(root, { force: true, recursive: true });
	}
});

function createFixture() {
	const projectRoot = mkdtempSync(join(tmpdir(), "dayova-gradle-jvm-"));
	fixtureRoots.push(projectRoot);
	return {
		projectRoot,
		propertiesPath: join(
			projectRoot,
			"android",
			"gradle",
			"gradle-daemon-jvm.properties",
		),
	};
}

test("creates the generated Gradle daemon JDK criterion", () => {
	const { projectRoot, propertiesPath } = createFixture();

	const result = prepareAndroidGradleJvm({
		projectRoot,
		requireNativeProject: false,
	});

	assert.deepEqual(result, { status: "created", propertiesPath });
	assert.equal(
		readFileSync(propertiesPath, "utf8"),
		GRADLE_DAEMON_JVM_PROPERTIES,
	);
});

test("repairs a stale Gradle daemon JDK criterion", () => {
	const { projectRoot, propertiesPath } = createFixture();
	prepareAndroidGradleJvm({ projectRoot, requireNativeProject: false });
	writeFileSync(propertiesPath, "toolchainVersion=25\n", "utf8");

	const result = prepareAndroidGradleJvm({
		projectRoot,
		requireNativeProject: false,
	});

	assert.deepEqual(result, { status: "updated", propertiesPath });
	assert.equal(
		readFileSync(propertiesPath, "utf8"),
		GRADLE_DAEMON_JVM_PROPERTIES,
	);
});

test("leaves the current Gradle daemon JDK criterion unchanged", () => {
	const { projectRoot, propertiesPath } = createFixture();
	prepareAndroidGradleJvm({ projectRoot, requireNativeProject: false });

	const result = prepareAndroidGradleJvm({
		projectRoot,
		requireNativeProject: false,
	});

	assert.deepEqual(result, { status: "current", propertiesPath });
	assert.equal(existsSync(dirname(propertiesPath)), true);
});

test("does not create a partial Android project before Expo prebuild", () => {
	const { projectRoot, propertiesPath } = createFixture();

	const result = prepareAndroidGradleJvm({ projectRoot });

	assert.deepEqual(result, { status: "absent", propertiesPath });
	assert.equal(existsSync(join(projectRoot, "android")), false);
});
