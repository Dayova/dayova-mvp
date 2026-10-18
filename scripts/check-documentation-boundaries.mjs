import { execFileSync } from "node:child_process";

// Inspect the index so force-added artifacts are rejected locally and in CI.
const archivedPaths = [
	"docs/evidence",
	"docs/pr-screenshots",
	"docs/qa",
	"docs/validation",
];
const tracked = execFileSync(
	"git",
	["ls-files", "--cached", "-z", "--", ...archivedPaths],
	{ cwd: new URL("../", import.meta.url), encoding: "utf8" },
)
	.split("\0")
	.filter(Boolean);

if (tracked.length > 0) {
	console.error(
		"Task reports and evidence belong on GitHub PRs/Linear issues; shared knowledge belongs in Notion.\n" +
			"See CONTEXT-MAP.md and docs/agents/domain.md. Remove these tracked paths:\n" +
			tracked.map((path) => `- ${path}`).join("\n"),
	);
	process.exitCode = 1;
} else {
	console.log("Documentation boundaries: no tracked task-archive files.");
}
