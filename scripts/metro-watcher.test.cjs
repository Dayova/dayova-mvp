const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");

test("Metro skips disappearing Git metadata while watching app sources", () => {
	const fixture = fs.mkdtempSync(
		path.join(os.tmpdir(), "dayova-metro-watcher-"),
	);
	const capture = path.join(
		fixture,
		".git",
		"refs",
		"codex",
		"turn-diffs",
		"captures",
		"capture",
	);
	fs.mkdirSync(capture, { recursive: true });
	fs.mkdirSync(path.join(fixture, "src"));
	fs.writeFileSync(path.join(fixture, "src", "index.js"), "export default 1;");

	try {
		// Run the real watcher in a child: the regression is an uncaught fs.watch
		// exception. Delete the empty capture exactly between discovery and watch.
		const result = spawnSync(
			process.execPath,
			[
				"-e",
				`
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const expoRequire = createRequire(require.resolve("expo/metro-config"));
const fileMapRoot = path.dirname(expoRequire.resolve("@expo/metro-file-map"));
const { default: FallbackWatcher } = require(path.join(fileMapRoot, "watchers/FallbackWatcher.js"));
const config = require("./metro.config");
const blockList = [config.resolver.blockList].flat().filter(Boolean);
const ignored = new RegExp(blockList.map(pattern => "(" + pattern.source + ")").join("|"));
const defaults = require("expo/metro-config").getDefaultConfig(process.cwd());
for (const pattern of [defaults.resolver.blockList].flat().filter(Boolean)) {
  assert.ok(blockList.some(actual => String(actual) === String(pattern)), "preserve Expo exclusions");
}
for (const separator of ["/", String.fromCharCode(92)]) {
  for (const parts of [[".git"], [".git", "refs", "codex"], ["repo", ".git"], ["repo", ".git", "objects"]]) {
    assert.ok(ignored.test(parts.join(separator)), "exclude Git directory and descendants on both platforms");
  }
  for (const parts of [["src", "index.js"], ["repo", ".github", "workflow.yml"], ["repo", ".gitignore"], ["repo", "legit", "index.js"]]) {
    assert.ok(!ignored.test(parts.join(separator)), "preserve non-Git paths");
  }
}
const fixture = process.env.METRO_WATCHER_FIXTURE;
const capture = path.join(fixture, ".git", "refs", "codex", "turn-diffs", "captures", "capture");
const watched = [];
const originalWatch = fs.watch;
fs.watch = (directory, ...args) => {
  watched.push(path.relative(fixture, directory));
  if (directory === capture) fs.rmdirSync(capture);
  return originalWatch(directory, ...args);
};
(async () => {
  const watcher = new FallbackWatcher(fixture, { ignored, globs: ["**/*.js"], dot: true });
  try {
    await watcher.startWatching();
    assert.ok(watched.includes("src"), "app sources must still be watched");
    assert.ok(!watched.some(directory => directory.split(path.sep).includes(".git")), "Git metadata must not be watched");
  } finally {
    await watcher.stopWatching();
    fs.watch = originalWatch;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
`,
			],
			{
				cwd: projectRoot,
				env: {
					...process.env,
					APP_VARIANT: "development",
					METRO_WATCHER_FIXTURE: fixture,
				},
				encoding: "utf8",
				timeout: 15_000,
			},
		);
		assert.equal(result.status, 0, result.error?.message ?? result.stderr);
	} finally {
		assert.equal(path.dirname(fixture), path.resolve(os.tmpdir()));
		assert.ok(path.basename(fixture).startsWith("dayova-metro-watcher-"));
		fs.rmSync(fixture, { recursive: true, force: true });
	}
});
