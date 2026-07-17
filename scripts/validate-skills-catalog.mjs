#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	duplicateExpoPluginSkills,
	expectedMattSkills,
	MATT_SOURCE,
	removedOrRenamedMattSkills,
	userInvokedMattSkills,
} from "./skills-policy.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));

const errors = [];
const warnings = [];

function fail(message) {
	errors.push(message);
}

function warn(message) {
	warnings.push(message);
}

function readText(path) {
	return readFileSync(path, "utf8");
}

function readJson(path) {
	return JSON.parse(readText(path));
}

function compareSets(label, actual, expected) {
	const actualSet = new Set(actual);
	const expectedSet = new Set(expected);
	const missing = expected.filter((item) => !actualSet.has(item));
	const unexpected = actual.filter((item) => !expectedSet.has(item)).sort();

	if (missing.length > 0 || unexpected.length > 0) {
		fail(
			`${label} changed unexpectedly. Missing: ${missing.join(", ") || "<none>"}. Unexpected: ${unexpected.join(", ") || "<none>"}. If this is intentional, update scripts/skills-policy.mjs and docs/agents/matt-pocock-skills.md in the same change.`,
		);
	}
}

function parseFrontmatter(text, path) {
	const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) {
		fail(`${path} is missing YAML frontmatter.`);
		return new Map();
	}

	const entries = new Map();
	for (const line of match[1].split(/\r?\n/)) {
		const keyMatch = line.match(/^([A-Za-z0-9_-]+):/);
		if (keyMatch) entries.set(keyMatch[1], line);
	}
	return entries;
}

function validateMattCatalog() {
	const lock = readJson(join(repoRoot, "skills-lock.json"));
	const lockEntries = Object.entries(lock.skills ?? {});
	const mattSkills = lockEntries
		.filter(([, entry]) => entry.source === MATT_SOURCE)
		.map(([name]) => name)
		.sort();

	compareSets("Curated Matt Pocock skill set", mattSkills, expectedMattSkills);

	for (const removedSkill of removedOrRenamedMattSkills) {
		if (lock.skills?.[removedSkill]) {
			fail(
				`Removed or renamed Matt skill is present in skills-lock.json: ${removedSkill}`,
			);
		}
		if (existsSync(join(repoRoot, ".agents", "skills", removedSkill))) {
			fail(
				`Removed or renamed Matt skill directory is present: .agents/skills/${removedSkill}`,
			);
		}
	}

	for (const skillName of expectedMattSkills) {
		const skillPath = join(
			repoRoot,
			".agents",
			"skills",
			skillName,
			"SKILL.md",
		);
		if (!existsSync(skillPath)) {
			fail(`Missing Matt skill file: .agents/skills/${skillName}/SKILL.md`);
			continue;
		}

		const frontmatter = parseFrontmatter(readText(skillPath), skillPath);
		const keys = [...frontmatter.keys()];
		const unsupported = keys.filter(
			(key) => key !== "name" && key !== "description",
		);
		if (unsupported.length > 0) {
			fail(
				`Matt skill ${skillName} has unsupported Codex frontmatter keys: ${unsupported.join(", ")}`,
			);
		}

		const openaiYamlPath = join(
			repoRoot,
			".agents",
			"skills",
			skillName,
			"agents",
			"openai.yaml",
		);
		if (!existsSync(openaiYamlPath)) {
			fail(
				`Missing OpenAI metadata: .agents/skills/${skillName}/agents/openai.yaml`,
			);
			continue;
		}

		const openaiYaml = readText(openaiYamlPath);
		const disablesImplicitInvocation =
			/allow_implicit_invocation:\s*false/.test(openaiYaml);
		if (userInvokedMattSkills.has(skillName) && !disablesImplicitInvocation) {
			fail(
				`${skillName} should be user-invoked but does not disable implicit invocation.`,
			);
		}
		if (!userInvokedMattSkills.has(skillName) && disablesImplicitInvocation) {
			fail(
				`${skillName} should be model-invoked but disables implicit invocation.`,
			);
		}
	}
}

function parseSkillConfigBlocks(configText) {
	const blocks = [];
	const blockPattern =
		/\[\[skills\.config\]\]([\s\S]*?)(?=\r?\n\[\[|\r?\n\[|$)/g;
	for (const match of configText.matchAll(blockPattern)) {
		const block = match[1];
		const name = block.match(/name\s*=\s*"([^"]+)"/)?.[1];
		const enabled = block.match(/enabled\s*=\s*(true|false)/)?.[1];
		if (name) blocks.push({ name, enabled });
	}
	return blocks;
}

function expoPluginEnabled(configText) {
	const match = configText.match(
		/\[plugins\."expo@openai-curated"\]([\s\S]*?)(?=\r?\n\[|$)/,
	);
	return match ? /enabled\s*=\s*true/.test(match[1]) : false;
}

function validateCodexConfig() {
	const configPath =
		process.env.CODEX_CONFIG_PATH || join(homedir(), ".codex", "config.toml");
	if (!existsSync(configPath)) {
		warn(
			`Codex config not found; skipped Expo plugin duplicate check: ${configPath}. Set CODEX_CONFIG_PATH if Codex uses a nonstandard config path.`,
		);
		return;
	}

	const configText = readText(configPath);
	if (!expoPluginEnabled(configText)) {
		warn(
			"Expo plugin is not enabled in Codex config; duplicate plugin skill check skipped. This is acceptable when the contributor does not use the plugin locally.",
		);
		return;
	}

	const skillConfig = new Map(
		parseSkillConfigBlocks(configText).map((block) => [
			block.name,
			block.enabled,
		]),
	);

	for (const skillName of duplicateExpoPluginSkills) {
		const enabled = skillConfig.get(skillName);
		if (enabled !== "false") {
			fail(
				`Duplicate Expo plugin skill must be disabled in Codex config (${configPath}): ${skillName}. Add or update [[skills.config]] with name = "${skillName}" and enabled = false.`,
			);
		}
	}
}

validateMattCatalog();
if (args.has("--check-codex-config")) validateCodexConfig();

for (const message of warnings) console.warn(`Warning: ${message}`);

if (errors.length > 0) {
	for (const message of errors) console.error(`Error: ${message}`);
	process.exit(1);
}

console.log(
	args.has("--check-codex-config")
		? "Skill catalog and Codex Expo plugin configuration are valid."
		: "Skill catalog is valid.",
);
