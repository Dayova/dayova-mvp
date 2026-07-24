import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { validateMattLockEntry, validateSkill } from "./skill-metadata.mjs";
import { duplicateExpoPluginSkills } from "./skills-policy.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const validatorPath = join(repoRoot, "scripts", "validate-skills-catalog.mjs");
const fixtureRoot = mkdtempSync(join(tmpdir(), "dayova-skill-catalog-"));

after(() => rmSync(fixtureRoot, { force: true, recursive: true }));

function runValidator(configPath, args = ["--check-codex-config"]) {
	return spawnSync(process.execPath, [validatorPath, ...args], {
		cwd: repoRoot,
		encoding: "utf8",
		env: { ...process.env, CODEX_CONFIG_PATH: configPath },
	});
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
