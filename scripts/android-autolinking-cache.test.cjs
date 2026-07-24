const assert = require("node:assert/strict");
const {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { afterEach, test } = require("node:test");

const {
	prepareAndroidAutolinkingCache,
} = require("./prepare-android-autolinking-cache.cjs");

const fixtureRoots = [];

afterEach(() => {
	for (const root of fixtureRoots.splice(0)) {
		rmSync(root, { force: true, recursive: true });
	}
});

function createFixture(sourceDirectory) {
	const projectRoot = mkdtempSync(join(tmpdir(), "dayova-autolinking-"));
	fixtureRoots.push(projectRoot);

	const cacheDirectory = join(
		projectRoot,
		"android",
		"build",
		"generated",
		"autolinking",
	);
	mkdirSync(cacheDirectory, { recursive: true });
	writeFileSync(
		join(cacheDirectory, "autolinking.json"),
		JSON.stringify({
			dependencies: {
				"native-package": {
					platforms: { android: { sourceDir: sourceDirectory } },
				},
			},
		}),
		"utf8",
	);
	writeFileSync(join(cacheDirectory, "package.json.sha"), "stale-hash", "utf8");

	return { cacheDirectory, projectRoot };
}

test("keeps a React Native Android autolinking cache whose source directories exist", () => {
	const existingSource = mkdtempSync(join(tmpdir(), "dayova-native-source-"));
	fixtureRoots.push(existingSource);
	const { cacheDirectory, projectRoot } = createFixture(existingSource);

	const result = prepareAndroidAutolinkingCache({ projectRoot });

	assert.deepEqual(result, { status: "fresh", missingSourceDirectories: [] });
	assert.equal(existsSync(join(cacheDirectory, "package.json.sha")), true);
});

test("invalidates the sentinel when pnpm layout changes leave stale native paths", () => {
	const missingSourceRoot = mkdtempSync(join(tmpdir(), "dayova-old-pnpm-"));
	fixtureRoots.push(missingSourceRoot);
	const missingSource = join(missingSourceRoot, "native-package");
	const { cacheDirectory, projectRoot } = createFixture(missingSource);

	const result = prepareAndroidAutolinkingCache({ projectRoot });

	assert.deepEqual(result, {
		status: "invalidated",
		missingSourceDirectories: [missingSource],
	});
	assert.equal(existsSync(join(cacheDirectory, "autolinking.json")), true);
	assert.equal(existsSync(join(cacheDirectory, "package.json.sha")), false);
});

test("invalidates the sentinel when a native source path is not a directory", () => {
	const sourceFile = join(tmpdir(), `dayova-native-file-${process.pid}`);
	fixtureRoots.push(sourceFile);
	writeFileSync(sourceFile, "not a directory", "utf8");
	const { cacheDirectory, projectRoot } = createFixture(sourceFile);

	const result = prepareAndroidAutolinkingCache({ projectRoot });

	assert.deepEqual(result, {
		status: "invalidated",
		missingSourceDirectories: [sourceFile],
	});
	assert.equal(existsSync(join(cacheDirectory, "package.json.sha")), false);
});

test("invalidates the sentinel when the generated JSON cannot be parsed", () => {
	const { cacheDirectory, projectRoot } = createFixture(tmpdir());
	writeFileSync(join(cacheDirectory, "autolinking.json"), "not-json", "utf8");

	const result = prepareAndroidAutolinkingCache({ projectRoot });

	assert.deepEqual(result, {
		status: "invalidated",
		missingSourceDirectories: [],
	});
	assert.equal(existsSync(join(cacheDirectory, "package.json.sha")), false);
});

for (const invalidConfig of [
	null,
	[],
	{ dependencies: null },
	{ dependencies: [] },
]) {
	test(`invalidates the sentinel for an invalid generated JSON shape: ${JSON.stringify(invalidConfig)}`, () => {
		const { cacheDirectory, projectRoot } = createFixture(tmpdir());
		writeFileSync(
			join(cacheDirectory, "autolinking.json"),
			JSON.stringify(invalidConfig),
			"utf8",
		);

		const result = prepareAndroidAutolinkingCache({ projectRoot });

		assert.deepEqual(result, {
			status: "invalidated",
			missingSourceDirectories: [],
		});
		assert.equal(existsSync(join(cacheDirectory, "package.json.sha")), false);
	});
}
