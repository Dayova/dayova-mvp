#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";
import {
	agentSystemGovernance,
	authorizationClasses,
	DAYOVA_REPOSITORY_SOURCE,
	evalSuites,
	skillGovernance,
	sourceGovernance,
} from "./agent-system-governance.mjs";
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

function validateNonEmptyString(value, label) {
	if (typeof value !== "string" || value.trim() === "") {
		fail(`${label} must be a non-empty string.`);
	}
}

function validateNonEmptyStringArray(value, label) {
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		value.some((item) => typeof item !== "string" || item.trim() === "")
	) {
		fail(`${label} must be a non-empty array of non-empty strings.`);
	}
}

function validateGovernanceRecord(label, record, allowedInvocations) {
	if (record === null || typeof record !== "object" || Array.isArray(record)) {
		fail(`${label} must be an object.`);
		return;
	}

	validateNonEmptyString(record.name, `${label}.name`);
	validateNonEmptyString(record.owner, `${label}.owner`);
	validateNonEmptyString(
		record.inclusionRationale,
		`${label}.inclusionRationale`,
	);
	validateNonEmptyString(
		record.overrideRationale,
		`${label}.overrideRationale`,
	);
	validateNonEmptyString(
		record.retirementCriteria,
		`${label}.retirementCriteria`,
	);

	if (
		record.pin === null ||
		typeof record.pin !== "object" ||
		Array.isArray(record.pin)
	) {
		fail(`${label}.pin must be an object.`);
	} else {
		validateNonEmptyString(record.pin.kind, `${label}.pin.kind`);
		validateNonEmptyString(record.pin.location, `${label}.pin.location`);
	}

	if (
		record.triggerBoundary === null ||
		typeof record.triggerBoundary !== "object" ||
		Array.isArray(record.triggerBoundary)
	) {
		fail(`${label}.triggerBoundary must be an object.`);
	} else {
		validateNonEmptyString(
			record.triggerBoundary.positive,
			`${label}.triggerBoundary.positive`,
		);
		validateNonEmptyString(
			record.triggerBoundary.negative,
			`${label}.triggerBoundary.negative`,
		);
		if (record.triggerBoundary.positive === record.triggerBoundary.negative) {
			fail(`${label} must have distinct positive and negative boundaries.`);
		}
	}

	if (!allowedInvocations.has(record.invocation)) {
		fail(
			`${label}.invocation must be one of: ${[...allowedInvocations].join(", ")}.`,
		);
	}

	validateNonEmptyStringArray(record.inputs, `${label}.inputs`);
	validateNonEmptyStringArray(record.outputs, `${label}.outputs`);
	validateNonEmptyStringArray(record.artifacts, `${label}.artifacts`);
	validateNonEmptyStringArray(record.evalSuite, `${label}.evalSuite`);

	if (
		record.systems === null ||
		typeof record.systems !== "object" ||
		Array.isArray(record.systems)
	) {
		fail(`${label}.systems must be an object.`);
	} else {
		validateNonEmptyStringArray(record.systems.read, `${label}.systems.read`);
		validateNonEmptyStringArray(record.systems.write, `${label}.systems.write`);
	}

	if (!authorizationClasses[record.authorizationClass]) {
		fail(
			`${label}.authorizationClass is unknown: ${record.authorizationClass ?? "<missing>"}.`,
		);
	}

	for (const suite of record.evalSuite ?? []) {
		if (!evalSuites[suite]) {
			fail(`${label}.evalSuite references unknown suite: ${suite}.`);
		}
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(record.lastReviewed ?? "")) {
		fail(`${label}.lastReviewed must be an ISO date.`);
	}
}

function metadataInvocationForSkill(skillName) {
	const metadataPath = join(
		repoRoot,
		".agents",
		"skills",
		skillName,
		"agents",
		"openai.yaml",
	);
	if (!existsSync(metadataPath)) return "implicit";

	let metadata;
	try {
		metadata = parseYaml(readText(metadataPath));
	} catch (error) {
		fail(
			`${skillName}: agents/openai.yaml is invalid YAML: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
	return metadata?.policy?.allow_implicit_invocation === false
		? "explicit"
		: "implicit";
}

function validateEvalSuites() {
	for (const [suiteName, suite] of Object.entries(evalSuites)) {
		validateNonEmptyString(suite.kind, `evalSuites.${suiteName}.kind`);
		validateNonEmptyString(suite.owner, `evalSuites.${suiteName}.owner`);
		if (
			!suite.command &&
			!suite.fixture &&
			!suite.result &&
			suite.status !== "planned"
		) {
			fail(
				`evalSuites.${suiteName} must declare a command, fixture, result, or planned status.`,
			);
		}
		if (suite.fixture && !existsSync(join(repoRoot, suite.fixture))) {
			fail(`evalSuites.${suiteName} fixture does not exist: ${suite.fixture}.`);
		}
		if (suite.result && !existsSync(join(repoRoot, suite.result))) {
			fail(`evalSuites.${suiteName} result does not exist: ${suite.result}.`);
		}
	}

	const fixturePath = join(
		repoRoot,
		evalSuites["maintain-agent-system-routing"].fixture,
	);
	if (!existsSync(fixturePath)) return;

	let fixture;
	try {
		fixture = readJson(fixturePath);
	} catch (error) {
		fail(
			`maintain-agent-system-routing fixture is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
		return;
	}
	if (fixture.skill !== "maintain-dayova-agent-system") {
		fail(
			"maintain-agent-system-routing fixture must target maintain-dayova-agent-system.",
		);
	}
	if (!Array.isArray(fixture.cases)) {
		fail("maintain-agent-system-routing fixture must contain cases.");
		return;
	}

	const ids = new Set();
	const kinds = new Map();
	for (const [index, testCase] of fixture.cases.entries()) {
		const label = `maintain-agent-system-routing.cases[${index}]`;
		validateNonEmptyString(testCase.id, `${label}.id`);
		validateNonEmptyString(testCase.kind, `${label}.kind`);
		validateNonEmptyString(testCase.prompt, `${label}.prompt`);
		validateNonEmptyString(
			testCase.expectedMutation,
			`${label}.expectedMutation`,
		);
		if (ids.has(testCase.id))
			fail(`${label}.id is duplicated: ${testCase.id}.`);
		ids.add(testCase.id);
		kinds.set(testCase.kind, (kinds.get(testCase.kind) ?? 0) + 1);

		if (
			testCase.kind === "positive-routing" &&
			testCase.expectedSelection !== "maintain-dayova-agent-system"
		) {
			fail(`${label} must select maintain-dayova-agent-system.`);
		}
		if (
			testCase.kind === "negative-routing" &&
			testCase.expectedExclusion !== "maintain-dayova-agent-system"
		) {
			fail(`${label} must exclude maintain-dayova-agent-system.`);
		}
	}

	for (const [kind, minimum] of [
		["positive-routing", 2],
		["negative-routing", 2],
		["mutation-safety", 2],
	]) {
		if ((kinds.get(kind) ?? 0) < minimum) {
			fail(
				`maintain-agent-system-routing requires at least ${minimum} ${kind} cases.`,
			);
		}
	}

	const resultPath = join(
		repoRoot,
		evalSuites["maintain-agent-system-routing"].result,
	);
	if (!existsSync(resultPath)) return;

	let result;
	try {
		result = readJson(resultPath);
	} catch (error) {
		fail(
			`maintain-agent-system-routing result is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
		return;
	}
	if (result.suite !== "maintain-agent-system-routing") {
		fail("maintain-agent-system-routing result must name its suite.");
	}
	if (result.schemaVersion !== 1) {
		fail("maintain-agent-system-routing result schemaVersion must be 1.");
	}
	if (result.ownerIssue !== "DAY-332") {
		fail("maintain-agent-system-routing result ownerIssue must be DAY-332.");
	}
	if (result.status !== "passed") {
		fail("maintain-agent-system-routing result must have passed status.");
	}
	validateNonEmptyString(
		result.mode,
		"maintain-agent-system-routing.result.mode",
	);
	validateNonEmptyString(
		result.prompt,
		"maintain-agent-system-routing.result.prompt",
	);
	if (
		typeof result.runAt !== "string" ||
		!Number.isFinite(Date.parse(result.runAt))
	) {
		fail("maintain-agent-system-routing result must have an ISO runAt value.");
	}
	if (!Array.isArray(result.observations) || result.observations.length === 0) {
		fail("maintain-agent-system-routing result must contain observations.");
	} else {
		for (const [index, observation] of result.observations.entries()) {
			validateNonEmptyString(
				observation,
				`maintain-agent-system-routing.result.observations[${index}]`,
			);
		}
	}
	for (const key of [
		"workflowOrder",
		"sourceOwnership",
		"authorizationBoundary",
		"completionCriteria",
	]) {
		if (result.assertions?.[key] !== "passed") {
			fail(`maintain-agent-system-routing result assertion ${key} must pass.`);
		}
	}
	if (result.assertions?.unauthorizedMutation !== "none") {
		fail(
			"maintain-agent-system-routing result must report no unauthorized mutation.",
		);
	}
	validateNonEmptyString(
		result.limitations,
		"maintain-agent-system-routing.result.limitations",
	);
}

function validateAgentSystemGovernance() {
	if (agentSystemGovernance.schemaVersion !== 1) {
		fail("Agent-system governance schemaVersion must be 1.");
	}

	for (const surface of ["knowledge", "work", "codeAndEvidence"]) {
		validateNonEmptyString(
			agentSystemGovernance.canonicalSurfaces?.[surface]?.name,
			`canonicalSurfaces.${surface}.name`,
		);
		validateNonEmptyString(
			agentSystemGovernance.canonicalSurfaces?.[surface]?.url,
			`canonicalSurfaces.${surface}.url`,
		);
	}

	const lock = readJson(join(repoRoot, "skills-lock.json"));
	const skillsRoot = join(repoRoot, ".agents", "skills");
	const installedSkills = readdirSync(skillsRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	const governedSkills = Object.keys(skillGovernance).sort();
	compareSets("Governed repository skill set", governedSkills, installedSkills);
	for (const skillName of installedSkills) {
		if (lock.skills?.[skillName]?.source === "expo/skills") continue;
		try {
			validateSkill(skillsRoot, skillName);
		} catch (error) {
			fail(error instanceof Error ? error.message : String(error));
		}
	}

	const installedSources = new Set(
		Object.values(lock.skills ?? {}).map((entry) => entry.source),
	);
	if (installedSkills.some((skill) => !lock.skills?.[skill])) {
		installedSources.add(DAYOVA_REPOSITORY_SOURCE);
	}
	compareSets(
		"Governed repository skill sources",
		Object.keys(sourceGovernance).sort(),
		[...installedSources].sort(),
	);

	for (const [sourceName, record] of Object.entries(sourceGovernance)) {
		validateGovernanceRecord(
			`sourceGovernance.${sourceName}`,
			record,
			new Set(["not-invocable"]),
		);
		if (record.name !== sourceName) {
			fail(`sourceGovernance.${sourceName}.name must match its key.`);
		}
	}

	for (const [skillName, record] of Object.entries(skillGovernance)) {
		validateGovernanceRecord(
			`skillGovernance.${skillName}`,
			record,
			new Set(["implicit", "explicit"]),
		);
		if (record.name !== skillName) {
			fail(`skillGovernance.${skillName}.name must match its key.`);
		}
		if (!sourceGovernance[record.source]) {
			fail(`skillGovernance.${skillName}.source is unknown: ${record.source}.`);
		}

		const lockEntry = lock.skills?.[skillName];
		const expectedSource = lockEntry?.source ?? DAYOVA_REPOSITORY_SOURCE;
		if (record.source !== expectedSource) {
			fail(
				`skillGovernance.${skillName}.source must be ${expectedSource}, found ${record.source}.`,
			);
		}
		const expectedInvocation = metadataInvocationForSkill(skillName);
		if (expectedInvocation && record.invocation !== expectedInvocation) {
			fail(
				`skillGovernance.${skillName}.invocation must match agents/openai.yaml (${expectedInvocation}).`,
			);
		}
	}

	validateEvalSuites();
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
		} catch (error) {
			fail(error instanceof Error ? error.message : String(error));
		}
		try {
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

validateAgentSystemGovernance();
validateMattCatalog();
if (args.has("--check-codex-config")) validateCodexConfig();

for (const message of warnings) console.warn(`Warning: ${message}`);

if (errors.length > 0) {
	for (const message of errors) console.error(`Error: ${message}`);
	process.exit(1);
}

console.log(
	args.has("--check-codex-config")
		? "Skill catalog, agent-system governance, and Codex Expo plugin configuration are valid."
		: "Skill catalog and agent-system governance are valid.",
);
