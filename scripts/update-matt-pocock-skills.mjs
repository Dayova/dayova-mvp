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
import {
	expectedMattSkills,
	MATT_SOURCE,
	userInvokedMattSkills,
} from "./skills-policy.mjs";
import {
	validateMattLockEntry,
	validateOpenAiMetadataForSkill,
	validateSkill,
} from "./skill-metadata.mjs";

const ALLOWED_FRONTMATTER_KEYS = new Set(["description", "name"]);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectSkillsRoot = join(projectRoot, ".agents", "skills");
const projectLockPath = join(projectRoot, "skills-lock.json");
const mattPatchRoot = join(projectRoot, "patches", "matt-pocock-skills");
const patchPath = join(mattPatchRoot, "dayova.patch");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const skillsCommand = join(
	projectRoot,
	"node_modules",
	".bin",
	process.platform === "win32" ? "skills.cmd" : "skills",
);

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

function validateCatalog(skillsRoot, mattEntries) {
	assertExpectedMattSet(mattEntries, "Curated Matt Pocock skill set");
	if (mattEntries.length === 0) {
		throw new Error("Matt Pocock catalog is empty");
	}
	for (const [skillName, entry] of mattEntries) {
		validateMattLockEntry(skillName, entry);
		validateSkill(skillsRoot, skillName);
		validateOpenAiMetadataForSkill(
			skillsRoot,
			skillName,
			userInvokedMattSkills.has(skillName),
		);
	}
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
			skillsCommand,
			["add", MATT_SOURCE, "--agent", "codex", "-y", "--copy"],
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
	const backedUpNames = allNames.filter((skillName) =>
		existsSync(join(projectSkillsRoot, skillName)),
	);
	let mutationStarted = false;

	try {
		for (const skillName of backedUpNames) {
			const source = join(projectSkillsRoot, skillName);
			cpSync(source, join(backupSkillsRoot, skillName), {
				recursive: true,
				preserveTimestamps: true,
			});
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
			for (const skillName of backedUpNames) {
				const backup = join(backupSkillsRoot, skillName);
				cpSync(backup, join(projectSkillsRoot, skillName), {
					recursive: true,
				});
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
