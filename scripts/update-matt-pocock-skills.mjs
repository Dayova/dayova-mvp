#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
	expectedMattSkills,
	MATT_SOURCE,
	userInvokedMattSkills,
} from "./skills-policy.mjs";

const ALLOWED_FRONTMATTER_KEYS = new Set(["description", "name"]);
const MAX_SKILL_NAME_LENGTH = 64;
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectSkillsRoot = join(projectRoot, ".agents", "skills");
const projectLockPath = join(projectRoot, "skills-lock.json");
const mattPatchRoot = join(projectRoot, "patches", "matt-pocock-skills");
const patchPath = join(mattPatchRoot, "dayova.patch");
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const args = new Set(process.argv.slice(2));
const supportedArgs = new Set(["--check", "--help", "--validate-current"]);
const unknownArgs = [...args].filter((arg) => !supportedArgs.has(arg));

if (unknownArgs.length > 0) {
	console.error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
	process.exit(2);
}

if (args.has("--help")) {
	console.log(`Usage: pnpm skills:update:matt [--check | --validate-current]

Fetch the latest Matt Pocock skills into an isolated workspace, keep Dayova's
curated skill set, normalize Codex frontmatter, apply Dayova's patch queue,
restore local OpenAI invocation metadata, validate the composed catalog, and
install it into .agents/skills.

Options:
  --check  Compare the latest composed catalog with the workspace without writing
  --validate-current  Validate the installed Matt catalog without network access
  --help   Show this help without contacting the network`);
	process.exit(0);
}

const selectedModes = ["--check", "--validate-current"].filter((mode) =>
	args.has(mode),
);
if (selectedModes.length > 1) {
	console.error(`Choose only one mode: ${selectedModes.join(", ")}`);
	process.exit(2);
}

function run(command, commandArgs, { cwd, capture = false, env = {} } = {}) {
	const usesWindowsCommandShim =
		process.platform === "win32" && command.endsWith(".cmd");
	const executable = usesWindowsCommandShim
		? (process.env.ComSpec ?? "cmd.exe")
		: command;
	const executableArgs = usesWindowsCommandShim
		? ["/d", "/s", "/c", command, ...commandArgs]
		: commandArgs;
	const result = spawnSync(executable, executableArgs, {
		cwd,
		encoding: "utf8",
		env: { ...process.env, ...env },
		shell: false,
		stdio: capture ? "pipe" : "inherit",
	});

	if (result.error) throw result.error;
	if (result.status !== 0) {
		if (capture) {
			if (result.stdout) process.stdout.write(result.stdout);
			if (result.stderr) process.stderr.write(result.stderr);
		}
		throw new Error(
			`${command} ${commandArgs.join(" ")} exited with status ${result.status}`,
		);
	}

	return capture ? result.stdout.trim() : "";
}

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function compareNames(left, right) {
	return left < right ? -1 : left > right ? 1 : 0;
}

function getMattEntries(lock) {
	return Object.entries(lock.skills ?? {})
		.filter(([, entry]) => entry.source === MATT_SOURCE)
		.sort(([left], [right]) => compareNames(left, right));
}

function assertExpectedMattSet(entries, label) {
	const actual = entries.map(([name]) => name).sort(compareNames);
	const expected = [...expectedMattSkills].sort(compareNames);
	const actualSet = new Set(actual);
	const expectedSet = new Set(expected);
	const missing = expected.filter((name) => !actualSet.has(name));
	const unexpected = actual.filter((name) => !expectedSet.has(name));
	if (missing.length > 0 || unexpected.length > 0) {
		throw new Error(
			`${label} changed unexpectedly. Missing: ${missing.join(", ") || "<none>"}. Unexpected: ${unexpected.join(", ") || "<none>"}. If this is intentional, update scripts/skills-policy.mjs and docs/agents/matt-pocock-skills.md in the same change.`,
		);
	}
}

function selectCuratedMattEntries(upstreamLock) {
	const upstreamEntries = new Map(getMattEntries(upstreamLock));
	const missing = expectedMattSkills.filter(
		(name) => !upstreamEntries.has(name),
	);
	if (missing.length > 0) {
		throw new Error(
			`Upstream Matt catalog no longer contains curated skill(s): ${missing.join(", ")}. Reconcile the curated set before updating.`,
		);
	}
	return [...expectedMattSkills]
		.sort(compareNames)
		.map((name) => [name, upstreamEntries.get(name)]);
}

function normalizeFrontmatter(content) {
	const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!frontmatterMatch) return content.replaceAll("\r\n", "\n");

	const lines = frontmatterMatch[1].split(/\r?\n/);
	const normalizedLines = [];
	let keepCurrentKey = false;
	for (const line of lines) {
		const keyMatch = line.match(/^([A-Za-z0-9_-]+):/);
		if (keyMatch) {
			keepCurrentKey = ALLOWED_FRONTMATTER_KEYS.has(keyMatch[1]);
		}
		if (keepCurrentKey) normalizedLines.push(line);
	}

	const normalizedFrontmatter = `---\n${normalizedLines.join("\n")}\n---`;
	return content
		.replace(frontmatterMatch[0], normalizedFrontmatter)
		.replaceAll("\r\n", "\n");
}

function normalizeCatalog(skillsRoot, skillNames) {
	for (const skillName of skillNames) {
		const skillPath = join(skillsRoot, skillName, "SKILL.md");
		const content = readFileSync(skillPath, "utf8");
		const normalized = normalizeFrontmatter(content);
		if (normalized !== content) writeFileSync(skillPath, normalized, "utf8");
	}
}

function validateSkill(skillsRoot, skillName) {
	const skillPath = join(skillsRoot, skillName, "SKILL.md");
	if (!existsSync(skillPath)) throw new Error(`${skillName}: missing SKILL.md`);

	const content = readFileSync(skillPath, "utf8");
	const frontmatterText = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
	if (!frontmatterText) {
		throw new Error(`${skillName}: missing YAML frontmatter`);
	}

	let frontmatter;
	try {
		frontmatter = parseYaml(frontmatterText);
	} catch (error) {
		throw new Error(`${skillName}: invalid YAML frontmatter: ${error.message}`);
	}
	if (
		frontmatter === null ||
		typeof frontmatter !== "object" ||
		Array.isArray(frontmatter)
	) {
		throw new Error(`${skillName}: frontmatter must be a YAML dictionary`);
	}

	const unexpectedKeys = Object.keys(frontmatter).filter(
		(key) => !ALLOWED_FRONTMATTER_KEYS.has(key),
	);
	if (unexpectedKeys.length > 0) {
		throw new Error(
			`${skillName}: unexpected frontmatter key(s): ${unexpectedKeys.join(", ")}`,
		);
	}
	if (!("name" in frontmatter)) {
		throw new Error(`${skillName}: frontmatter is missing name`);
	}
	if (!("description" in frontmatter)) {
		throw new Error(`${skillName}: frontmatter is missing description`);
	}

	if (typeof frontmatter.name !== "string") {
		throw new Error(`${skillName}: frontmatter name must be a string`);
	}
	const name = frontmatter.name.trim();
	if (name && !/^[a-z0-9-]+$/.test(name)) {
		throw new Error(`${skillName}: name must use lowercase hyphen-case`);
	}
	if (name.startsWith("-") || name.endsWith("-") || name.includes("--")) {
		throw new Error(`${skillName}: name has invalid hyphen placement`);
	}
	if (name.length > MAX_SKILL_NAME_LENGTH) {
		throw new Error(
			`${skillName}: name exceeds ${MAX_SKILL_NAME_LENGTH} characters`,
		);
	}
	if (name !== skillName) {
		throw new Error(`${skillName}: frontmatter name does not match its folder`);
	}

	if (typeof frontmatter.description !== "string") {
		throw new Error(`${skillName}: frontmatter description must be a string`);
	}
	const description = frontmatter.description.trim();
	if (description.includes("<") || description.includes(">")) {
		throw new Error(`${skillName}: description cannot contain angle brackets`);
	}
	if (description.length > 1024) {
		throw new Error(`${skillName}: description exceeds 1024 characters`);
	}

	for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
		const rawTarget = match[1]?.replace(/^<|>$/g, "").split("#", 1)[0];
		if (rawTarget === "link") continue;
		if (!rawTarget || /^[a-z][a-z0-9+.-]*:/i.test(rawTarget)) continue;
		const target = resolve(dirname(skillPath), rawTarget);
		if (!existsSync(target)) {
			throw new Error(`${skillName}: local link does not exist: ${rawTarget}`);
		}
	}
}

function readYaml(path, label) {
	try {
		return parseYaml(readFileSync(path, "utf8"));
	} catch (error) {
		throw new Error(`${label}: invalid YAML: ${error.message}`);
	}
}

function validateOpenAiMetadata(skillsRoot, skillNames) {
	for (const skillName of skillNames) {
		const openaiYamlPath = join(skillsRoot, skillName, "agents", "openai.yaml");
		if (!existsSync(openaiYamlPath)) {
			throw new Error(`${skillName}: missing agents/openai.yaml`);
		}
		const openaiYaml = readYaml(
			openaiYamlPath,
			`${skillName}: agents/openai.yaml`,
		);
		const allowsImplicitInvocation =
			openaiYaml?.policy?.allow_implicit_invocation !== false;
		if (userInvokedMattSkills.has(skillName) && allowsImplicitInvocation) {
			throw new Error(
				`${skillName}: user-invoked skill must set policy.allow_implicit_invocation: false`,
			);
		}
		if (!userInvokedMattSkills.has(skillName) && !allowsImplicitInvocation) {
			throw new Error(
				`${skillName}: model-invoked skill must not disable implicit invocation`,
			);
		}
	}
}

function validateCatalog(skillsRoot, mattEntries) {
	assertExpectedMattSet(mattEntries, "Curated Matt Pocock skill set");
	if (mattEntries.length === 0) {
		throw new Error("Matt Pocock catalog is empty");
	}
	for (const [skillName, entry] of mattEntries) {
		if (entry.sourceType !== "github") {
			throw new Error(
				`${skillName}: unexpected source type ${entry.sourceType}`,
			);
		}
		if (!/^[a-f0-9]{64}$/.test(entry.computedHash)) {
			throw new Error(`${skillName}: invalid upstream hash`);
		}
		validateSkill(skillsRoot, skillName);
	}
	validateOpenAiMetadata(
		skillsRoot,
		mattEntries.map(([name]) => name),
	);
}

function copyLocalOpenAiMetadata(composedSkillsRoot, skillNames) {
	for (const skillName of skillNames) {
		const source = join(projectSkillsRoot, skillName, "agents");
		const target = join(composedSkillsRoot, skillName, "agents");
		if (!existsSync(source)) {
			throw new Error(
				`Missing local OpenAI metadata for Matt skill: .agents/skills/${skillName}/agents`,
			);
		}
		rmSync(target, { force: true, recursive: true });
		cpSync(source, target, { recursive: true, preserveTimestamps: true });
	}
}

function mergeSkillLocks(currentLock, mattEntries) {
	const currentNonMattEntries = Object.entries(currentLock.skills ?? {}).filter(
		([, entry]) => entry.source !== MATT_SOURCE,
	);
	const currentNonMattNames = new Set(
		currentNonMattEntries.map(([name]) => name),
	);
	for (const [name] of mattEntries) {
		if (currentNonMattNames.has(name)) {
			throw new Error(
				`Matt skill ${name} conflicts with an existing non-Matt skill`,
			);
		}
	}

	const mergedEntries = [...currentNonMattEntries, ...mattEntries].sort(
		([left], [right]) => compareNames(left, right),
	);

	return {
		...currentLock,
		skills: Object.fromEntries(mergedEntries),
	};
}

function serializeLike(content, value) {
	const eol = content.includes("\r\n") ? "\r\n" : "\n";
	return `${JSON.stringify(value, null, 2).replaceAll("\n", eol)}${eol}`;
}

function listFiles(root, current = root) {
	if (!existsSync(current)) return [];
	const files = [];
	for (const entry of readdirSync(current, { withFileTypes: true })) {
		const absolutePath = join(current, entry.name);
		if (entry.isDirectory()) files.push(...listFiles(root, absolutePath));
		else if (entry.isFile()) files.push(relative(root, absolutePath));
		else throw new Error(`Unsupported filesystem entry: ${absolutePath}`);
	}
	return files.sort(compareNames);
}

function treeHash(root) {
	if (!existsSync(root)) return null;
	const hash = createHash("sha256");
	for (const file of listFiles(root)) {
		hash.update(file.split(sep).join("/"));
		hash.update("\0");
		const content = readFileSync(join(root, file));
		hash.update(
			content.includes(0)
				? content
				: Buffer.from(content.toString("utf8").replaceAll("\r\n", "\n")),
		);
		hash.update("\0");
	}
	return hash.digest("hex");
}

function assertManagedPath(path) {
	const relativePath = relative(projectSkillsRoot, path);
	if (
		relativePath === "" ||
		relativePath === ".." ||
		relativePath.startsWith(`..${sep}`) ||
		resolve(path) === resolve(projectSkillsRoot)
	) {
		throw new Error(`Refusing to modify path outside a skill folder: ${path}`);
	}
}

function cleanupTree(path) {
	if (!path || !existsSync(path)) return;
	rmSync(path, {
		force: true,
		maxRetries: 3,
		recursive: true,
		retryDelay: 100,
	});
}

function applyDayovaPatch(fetchRoot) {
	try {
		run("git", ["apply", "--check", "--whitespace=nowarn", patchPath], {
			cwd: fetchRoot,
		});
		run("git", ["apply", "--whitespace=nowarn", patchPath], {
			cwd: fetchRoot,
		});
	} catch (error) {
		throw new Error(
			`Matt Pocock patch queue no longer applies cleanly. Reconcile ${relative(projectRoot, patchPath)} against the latest upstream catalog before updating.\n${error.message}`,
		);
	}
}

function fetchAndCompose() {
	const cacheRoot = join(projectRoot, "node_modules", ".cache");
	mkdirSync(cacheRoot, { recursive: true });
	const fetchRoot = mkdtempSync(join(cacheRoot, "dayova-matt-skills-"));
	const cliTempRoot = join(fetchRoot, ".tmp");
	const npmCacheRoot = join(fetchRoot, ".npm-cache");
	mkdirSync(cliTempRoot, { recursive: true });
	mkdirSync(npmCacheRoot, { recursive: true });
	try {
		run("git", ["init", "--quiet"], { cwd: fetchRoot });
		console.log("Fetching the latest Matt Pocock skill catalog...");
		run(
			npxCommand,
			["skills@latest", "add", MATT_SOURCE, "--agent", "codex", "-y", "--copy"],
			{
				cwd: fetchRoot,
				capture: true,
				env: {
					TEMP: cliTempRoot,
					TMP: cliTempRoot,
					npm_config_cache: npmCacheRoot,
				},
			},
		);

		const upstreamLock = readJson(join(fetchRoot, "skills-lock.json"));
		const mattEntries = selectCuratedMattEntries(upstreamLock);
		const skillNames = mattEntries.map(([name]) => name);
		const skillsRoot = join(fetchRoot, ".agents", "skills");

		normalizeCatalog(skillsRoot, skillNames);
		applyDayovaPatch(fetchRoot);
		copyLocalOpenAiMetadata(skillsRoot, skillNames);
		validateCatalog(skillsRoot, mattEntries);

		return { fetchRoot, mattEntries, skillsRoot, upstreamLock };
	} catch (error) {
		cleanupTree(fetchRoot);
		throw error;
	}
}

function findChanges(
	currentNames,
	composedNames,
	composedSkillsRoot,
	lockChanged,
) {
	const changes = [];
	const allNames = [...new Set([...currentNames, ...composedNames])].sort(
		compareNames,
	);
	for (const skillName of allNames) {
		const currentHash = treeHash(join(projectSkillsRoot, skillName));
		const composedHash = treeHash(join(composedSkillsRoot, skillName));
		if (currentHash !== composedHash) changes.push(skillName);
	}
	if (lockChanged) changes.push("skills-lock.json");
	return changes;
}

function assertManagedPathsClean(skillNames) {
	const paths = [
		...skillNames.map((name) => `.agents/skills/${name}`),
		"skills-lock.json",
	];
	const status = run(
		"git",
		["status", "--porcelain=v1", "--untracked-files=all", "--", ...paths],
		{ cwd: projectRoot, capture: true },
	);
	if (status) {
		throw new Error(
			`Refusing to overwrite uncommitted Matt Pocock skill changes:\n${status}`,
		);
	}
}

function installComposedCatalog({
	composedLockText,
	composedNames,
	composedSkillsRoot,
	currentLockText,
	currentNames,
}) {
	const allNames = [...new Set([...currentNames, ...composedNames])].sort(
		compareNames,
	);
	assertManagedPathsClean(allNames);

	const backupRoot = mkdtempSync(join(projectRoot, ".matt-skills-backup-"));
	const backupSkillsRoot = join(backupRoot, "skills");
	mkdirSync(backupSkillsRoot, { recursive: true });
	let mutationStarted = false;

	try {
		for (const skillName of currentNames) {
			const source = join(projectSkillsRoot, skillName);
			if (existsSync(source)) {
				cpSync(source, join(backupSkillsRoot, skillName), {
					recursive: true,
					preserveTimestamps: true,
				});
			}
		}

		mutationStarted = true;
		for (const skillName of allNames) {
			const target = join(projectSkillsRoot, skillName);
			assertManagedPath(target);
			rmSync(target, { force: true, recursive: true });
		}

		for (const skillName of composedNames) {
			cpSync(
				join(composedSkillsRoot, skillName),
				join(projectSkillsRoot, skillName),
				{ recursive: true, preserveTimestamps: true },
			);
		}
		writeFileSync(projectLockPath, composedLockText, "utf8");

		run(pnpmCommand, ["skills:validate"], { cwd: projectRoot });
	} catch (error) {
		if (mutationStarted) {
			for (const skillName of allNames) {
				const target = join(projectSkillsRoot, skillName);
				assertManagedPath(target);
				rmSync(target, { force: true, recursive: true });
			}
			for (const skillName of currentNames) {
				const backup = join(backupSkillsRoot, skillName);
				if (existsSync(backup)) {
					cpSync(backup, join(projectSkillsRoot, skillName), {
						recursive: true,
					});
				}
			}
			writeFileSync(projectLockPath, currentLockText, "utf8");
		}
		const outcome = mutationStarted
			? "failed and was rolled back"
			: "stopped before modifying the workspace";
		throw new Error(`Matt Pocock skill update ${outcome}: ${error.message}`);
	} finally {
		cleanupTree(backupRoot);
	}
}

let fetchRoot;
try {
	if (!existsSync(patchPath)) {
		throw new Error(`Missing patch queue: ${patchPath}`);
	}
	if (!existsSync(projectLockPath)) throw new Error("Missing skills-lock.json");

	const currentLockText = readFileSync(projectLockPath, "utf8");
	const currentLock = JSON.parse(currentLockText);
	const currentMattEntries = getMattEntries(currentLock);
	const currentNames = currentMattEntries.map(([name]) => name);
	if (args.has("--validate-current")) {
		validateCatalog(projectSkillsRoot, currentMattEntries);
		console.log(
			`Validated ${currentNames.length} installed Matt Pocock skills.`,
		);
		process.exit(0);
	}

	const composed = fetchAndCompose();
	fetchRoot = composed.fetchRoot;
	const composedNames = composed.mattEntries.map(([name]) => name);
	const mergedLock = mergeSkillLocks(currentLock, composed.mattEntries);
	const composedLockText = serializeLike(currentLockText, mergedLock);
	const changes = findChanges(
		currentNames,
		composedNames,
		composed.skillsRoot,
		currentLockText !== composedLockText,
	);

	if (args.has("--check")) {
		if (changes.length > 0) {
			console.error("Matt Pocock skill composition is out of date:");
			for (const change of changes) console.error(`  - ${change}`);
			process.exitCode = 1;
		} else {
			console.log(
				`Matt Pocock skill composition is current (${composedNames.length} skills validated).`,
			);
		}
	} else if (changes.length === 0) {
		console.log(
			`Matt Pocock skill composition is already current (${composedNames.length} skills validated).`,
		);
	} else {
		installComposedCatalog({
			composedLockText,
			composedNames,
			composedSkillsRoot: composed.skillsRoot,
			currentLockText,
			currentNames,
		});
		console.log(
			`Updated and verified ${composedNames.length} composed Matt Pocock skills. Review the Git diff before committing.`,
		);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	if (fetchRoot && existsSync(fetchRoot)) {
		cleanupTree(fetchRoot);
	}
}
