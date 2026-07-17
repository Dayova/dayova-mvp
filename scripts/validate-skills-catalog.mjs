#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseToml } from "smol-toml";
import {
	duplicateExpoPluginSkills,
	expectedMattSkills,
	MATT_SOURCE,
	removedOrRenamedMattSkills,
	userInvokedMattSkills,
} from "./skills-policy.mjs";
import {
	validateMattLockEntry,
	validateOpenAiMetadataForSkill,
	validateSkill,
} from "./skill-metadata.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const supportedArgs = new Set(["--check-codex-config"]);
const unknownArgs = [...args].filter((arg) => !supportedArgs.has(arg));
if (unknownArgs.length > 0) {
	console.error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
	process.exit(2);
}

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
		try {
			validateMattLockEntry(skillName, lock.skills?.[skillName]);
		} catch (error) {
			fail(error instanceof Error ? error.message : String(error));
		}
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

		try {
			validateSkill(join(repoRoot, ".agents", "skills"), skillName);
			validateOpenAiMetadataForSkill(
				join(repoRoot, ".agents", "skills"),
				skillName,
				userInvokedMattSkills.has(skillName),
			);
		} catch (error) {
			fail(error instanceof Error ? error.message : String(error));
		}
	}
}

function parseSkillConfig(config) {
	const entries = config?.skills?.config;
	if (!Array.isArray(entries)) return [];
	return entries.filter(
		(entry) =>
			entry !== null &&
			typeof entry === "object" &&
			typeof entry.name === "string",
	);
}

function expoPluginEnabled(config) {
	return config?.plugins?.["expo@openai-curated"]?.enabled === true;
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

	let config;
	try {
		config = parseToml(readText(configPath));
	} catch (error) {
		fail(
			`Codex config is invalid TOML (${configPath}): ${error instanceof Error ? error.message : String(error)}`,
		);
		return;
	}
	if (!expoPluginEnabled(config)) {
		warn(
			"Expo plugin is not enabled in Codex config; duplicate plugin skill check skipped. This is acceptable when the contributor does not use the plugin locally.",
		);
		return;
	}

	const skillConfig = new Map(
		parseSkillConfig(config).map((block) => [block.name, block.enabled]),
	);

	for (const skillName of duplicateExpoPluginSkills) {
		const enabled = skillConfig.get(skillName);
		if (enabled !== false) {
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
