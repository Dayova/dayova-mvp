const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../../..");
const generated = path.join(root, ".expo/pr884");
fs.mkdirSync(generated, { recursive: true });
const entry = path.join(root, "index.ts");
const backup = path.join(generated, "index.original");
const baseline = path.join(
	root,
	"src/features/learning-plans/pr884-baseline.generated.tsx",
);
const fixtureEntry =
	'import { registerRootComponent } from "expo";\nimport EvidenceApp from "./scripts/evidence/pr884/app";\nregisterRootComponent(EvidenceApp);\n';
const baselineSource = execFileSync(
	"git",
	[
		"show",
		"3eb4e5d29f8cb2771fb79825c3b447587c514740:src/features/learning-plans/learning-plan-setup-steps.tsx",
	],
	{ cwd: root },
);
if (process.argv.includes("--restore")) {
	if (
		fs.existsSync(baseline) &&
		!fs.readFileSync(baseline).equals(baselineSource)
	)
		throw new Error(
			"Generated baseline was edited; preserve those changes before restoring.",
		);
	if (fs.existsSync(backup)) {
		if (fs.readFileSync(entry, "utf8") !== fixtureEntry)
			throw new Error(
				"Entry was edited after evidence setup; preserve those changes before restoring.",
			);
		fs.copyFileSync(backup, entry);
		fs.unlinkSync(backup);
	}
	if (fs.existsSync(baseline)) fs.unlinkSync(baseline);
} else {
	if (fs.existsSync(backup))
		throw new Error("Restore the existing evidence entry first.");
	if (fs.existsSync(baseline))
		throw new Error("Generated baseline already exists.");
	fs.copyFileSync(entry, backup);
	fs.writeFileSync(baseline, baselineSource);
	fs.writeFileSync(entry, fixtureEntry);
}
