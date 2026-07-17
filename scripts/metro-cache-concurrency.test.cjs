const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const MAX_CONCURRENT_FILE_READS = 256;
const REQUEST_COUNT = MAX_CONCURRENT_FILE_READS * 4;

function loadExpoFileStore() {
	const expoPackage = require.resolve("expo/package.json");
	const metroConfigPackage = require.resolve("@expo/metro-config/package.json", {
		paths: [expoPackage],
	});
	const metroConfigRoot = path.dirname(metroConfigPackage);
	return require(path.join(metroConfigRoot, "build", "binary-file-store.js"))
		.FileStore;
}

test("Expo's Metro file store bounds concurrent cache reads", async () => {
	const FileStore = loadExpoFileStore();
	const originalReadFile = fs.promises.readFile;
	let activeReads = 0;
	let peakReads = 0;

	fs.promises.readFile = async () => {
		activeReads++;
		peakReads = Math.max(peakReads, activeReads);

		try {
			await new Promise((resolve) => setImmediate(resolve));
			const missing = new Error("simulated cache miss");
			missing.code = "ENOENT";
			throw missing;
		} finally {
			activeReads--;
		}
	};

	try {
		const store = new FileStore({ root: path.join(process.cwd(), ".metro-test") });
		const keys = Array.from({ length: REQUEST_COUNT }, (_, index) => {
			const key = Buffer.alloc(32);
			key.writeUInt32BE(index);
			return key;
		});

		await Promise.all(keys.map((key) => store.get(key)));
	} finally {
		fs.promises.readFile = originalReadFile;
	}

	assert.equal(activeReads, 0);
	assert.ok(
		peakReads <= MAX_CONCURRENT_FILE_READS,
		`expected at most ${MAX_CONCURRENT_FILE_READS} concurrent reads, saw ${peakReads}`,
	);
	assert.ok(peakReads > 1, "cache reads should remain concurrent");
});
