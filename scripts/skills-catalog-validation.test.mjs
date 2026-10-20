import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	cpSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateMattLockEntry, validateSkill } from "./skill-metadata.mjs";
import { duplicateExpoPluginSkills } from "./skills-policy.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = mkdtempSync(join(tmpdir(), "dayova-skill-catalog-"));

after(() => rmSync(fixtureRoot, { force: true, recursive: true }));

function runValidator(
	configPath,
	args = ["--check-codex-config"],
	root = repoRoot,
) {
	return spawnSync(
		process.execPath,
		[join(root, "scripts", "validate-skills-catalog.mjs"), ...args],
		{
			cwd: root,
			encoding: "utf8",
			env: { ...process.env, CODEX_CONFIG_PATH: configPath },
		},
	);
}

function writeConfig(name, content) {
	const path = join(fixtureRoot, name);
	writeFileSync(path, content, "utf8");
	return path;
}

function tomlString(value) {
	return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

test("warns and succeeds when the Codex config is missing", () => {
	const result = runValidator(join(fixtureRoot, "missing.toml"));
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stderr, /Codex config not found/);
});

// Exercise governance rejection paths against an isolated catalog. Restore each
// mutation so tests never edit the contributor's installed skills or manifest.
const governanceFixture = join(fixtureRoot, "governance");
for (const path of [".agents", "docs", "scripts", "skills-lock.json"]) {
	cpSync(join(repoRoot, path), join(governanceFixture, path), {
		recursive: true,
	});
}
symlinkSync(
	join(repoRoot, "node_modules"),
	join(governanceFixture, "node_modules"),
	"junction",
);

function checkGovernanceMutation(path, transform, expectedError) {
	const target = join(governanceFixture, path);
	const original = readFileSync(target, "utf8");
	try {
		writeFileSync(target, transform(original), "utf8");
		const result = runValidator(undefined, [], governanceFixture);
		assert.equal(result.status, 1, result.stderr);
		assert.match(result.stderr, expectedError);
	} finally {
		writeFileSync(target, original, "utf8");
	}
}

test("accepts the isolated governed catalog without historical execution reports", () => {
	const result = runValidator(undefined, [], governanceFixture);
	assert.equal(result.status, 0, result.stderr);
});

test("rejects an installed skill without a governance record", () => {
	const skillRoot = join(
		governanceFixture,
		".agents",
		"skills",
		"ungoverned-fixture",
	);
	mkdirSync(skillRoot, { recursive: true });
	writeFileSync(
		join(skillRoot, "SKILL.md"),
		"---\nname: ungoverned-fixture\ndescription: Test governance coverage\n---\n",
	);
	try {
		const result = runValidator(undefined, [], governanceFixture);
		assert.equal(result.status, 1, result.stderr);
		assert.match(
			result.stderr,
			/Governed repository skill set.*ungoverned-fixture/,
		);
	} finally {
		rmSync(skillRoot, { recursive: true, force: true });
	}
});

test("rejects authorization classes outside the governed set", () => {
	checkGovernanceMutation(
		"scripts/agent-system-governance.mjs",
		(text) =>
			`${text}\nskillGovernance.research.authorizationClass = 'unrestricted';\n`,
		/skillGovernance.research.authorizationClass is unknown: unrestricted/,
	);
});

test("rejects invocation drift between governance and installed metadata", () => {
	checkGovernanceMutation(
		".agents/skills/maintain-dayova-agent-system/agents/openai.yaml",
		(text) =>
			text.replace(
				"allow_implicit_invocation: true",
				"allow_implicit_invocation: false",
			),
		/maintain-dayova-agent-system.invocation must match agents\/openai.yaml \(explicit\)/,
	);
});

test("rejects an evaluation suite whose maintained fixture is missing", () => {
	checkGovernanceMutation(
		"scripts/agent-system-governance.mjs",
		(text) =>
			`${text}\nevalSuites['maintain-agent-system-routing'].fixture = '.agents/evals/missing.json';\n`,
		/fixture does not exist: .agents\/evals\/missing.json/,
	);
});

test("rejects behavioral case sets that lose mutation-safety coverage", () => {
	checkGovernanceMutation(
		".agents/evals/maintain-dayova-agent-system.json",
		(text) => {
			const fixture = JSON.parse(text);
			fixture.cases = fixture.cases.filter(
				(entry) => entry.kind !== "mutation-safety",
			);
			return JSON.stringify(fixture);
		},
		/requires at least 2 mutation-safety cases/,
	);
});

test("skips duplicate checks when the Expo plugin is disabled", () => {
	const configPath = writeConfig(
		"disabled.toml",
		'[plugins."expo@openai-curated"]\nenabled = false\n',
	);
	const result = runValidator(configPath);
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stderr, /Expo plugin is not enabled/);
});

test("rejects enabled duplicate Expo skills", () => {
	const configPath = writeConfig(
		"duplicates.toml",
		'[plugins."expo@openai-curated"]\nenabled = true\n',
	);
	const result = runValidator(configPath);
	assert.equal(result.status, 1);
	assert.match(result.stderr, new RegExp(duplicateExpoPluginSkills[0]));
});

test("accepts structurally parsed disabled duplicate skills", () => {
	const skillEntries = duplicateExpoPluginSkills
		.map(
			(skillName) =>
				`[[skills.config]]\nname = ${tomlString(skillName)}\nenabled = false`,
		)
		.join("\n\n");
	const configPath = writeConfig(
		"valid.toml",
		`# A comment containing [plugins."expo@openai-curated"] must not affect parsing.\n[plugins."expo@openai-curated"]\nenabled = true\n\n${skillEntries}\n`,
	);
	const result = runValidator(configPath);
	assert.equal(result.status, 0, result.stderr);
});

test("reports malformed TOML", () => {
	const configPath = writeConfig(
		"invalid.toml",
		'[plugins."expo@openai-curated"\nenabled = true\n',
	);
	const result = runValidator(configPath);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Codex config is invalid TOML/);
});

test("rejects unknown command-line arguments", () => {
	const result = runValidator(join(fixtureRoot, "missing.toml"), ["--chek"]);
	assert.equal(result.status, 2);
	assert.match(result.stderr, /Unknown argument\(s\): --chek/);
});

test("validates Matt lock metadata shared by both catalog paths", () => {
	assert.doesNotThrow(() =>
		validateMattLockEntry("research", {
			computedHash: "a".repeat(64),
			sourceType: "github",
		}),
	);
	assert.throws(
		() =>
			validateMattLockEntry("research", {
				computedHash: "not-a-sha256",
				sourceType: "github",
			}),
		/invalid upstream hash/,
	);
});

test("rejects a frontmatter closing delimiter with trailing content", () => {
	const skillsRoot = join(fixtureRoot, "skills");
	const skillName = "malformed-frontmatter";
	const skillRoot = join(skillsRoot, skillName);
	mkdirSync(skillRoot, { recursive: true });
	writeFileSync(
		join(skillRoot, "SKILL.md"),
		"---\nname: malformed-frontmatter\ndescription: Invalid delimiter fixture\n---anything\n# Body\n",
		"utf8",
	);

	assert.throws(
		() => validateSkill(skillsRoot, skillName),
		/missing YAML frontmatter/,
	);
});
