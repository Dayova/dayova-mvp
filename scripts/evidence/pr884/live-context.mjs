// Synthetic, read-only development action checks. Never uses a learner account.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const cli = fileURLToPath(
	new URL("../../../node_modules/convex/bin/main.js", import.meta.url),
);
const cases = [
	["Rechnungswesen", "Bilanz"],
	["Mathematik", "Bilanz"],
	["Mathe LK", "Vektor"],
	["Wirtschaft und Recht", "Bilanz"],
	["Mein Spezialfach", "Bilanz"],
	["Biologie", "Zelle"],
];
const results = cases.map(([subject, query]) => {
	const raw = execFileSync(
		process.execPath,
		[
			cli,
			"run",
			"wloTopics:search",
			JSON.stringify({ subject, query }),
			"--deployment-name",
			"kindred-canary-599",
			"--identity",
			JSON.stringify({
				subject: "pr884-context-synthetic",
				issuer: "https://evidence.invalid",
			}),
		],
		{ cwd: root, encoding: "utf8", timeout: 60_000 },
	);
	const result = JSON.parse(raw);
	assert.ok(result.topics.length > 0, `${subject}/${query}: no live matches`);
	if (query === "Bilanz") assert.equal(result.topics[0].title, "Bilanz");
	assert.ok(result.topics.every((topic) => Array.isArray(topic.subjects)));
	return { subject, query, result };
});
const report = {
	capturedAt: new Date().toISOString(),
	deployment: "kindred-canary-599",
	authentication: "synthetic CLI identity, not Clerk sign-in",
	results,
};
if (process.argv[2])
	writeFileSync(process.argv[2], `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
