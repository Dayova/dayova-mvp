#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const EXPO_SOURCE = "expo/skills";
const ALLOWED_FRONTMATTER_KEYS = new Set([
	"allowed-tools",
	"description",
	"license",
	"metadata",
	"name",
]);
const MAX_SKILL_NAME_LENGTH = 64;
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectSkillsRoot = join(projectRoot, ".agents", "skills");
const projectLockPath = join(projectRoot, "skills-lock.json");
const expoPatchRoot = join(projectRoot, "patches", "expo-skills");
const patchPath = join(expoPatchRoot, "dayova.patch");
const overrideFilesRoot = join(expoPatchRoot, "files");
const overrideManifestPath = join(expoPatchRoot, "overrides.json");
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
	console.log(`Usage: pnpm skills:update:expo [--check | --validate-current]

Fetch the latest Expo skills into an isolated workspace, normalize their
frontmatter, apply Dayova's patch queue and checked replacements, validate the
composed catalog, and install it into .agents/skills.

Options:
  --check  Compare the latest composed catalog with the workspace without writing
  --validate-current  Validate the installed Expo catalog without network access
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

function getExpoEntries(lock) {
	return Object.entries(lock.skills)
		.filter(([, entry]) => entry.source === EXPO_SOURCE)
		.sort(([left], [right]) => compareNames(left, right));
}

function normalizeFrontmatter(content) {
	const frontmatter = content.match(/^---\r?\n[\s\S]*?\r?\n---/)?.[0];
	if (!frontmatter) return content;
	return content.replace(
		frontmatter,
		frontmatter.replace(/^version:.*(?:\r?\n|$)/gm, ""),
	);
}

function normalizeCatalog(skillsRoot, skillNames) {
	for (const skillName of skillNames) {
		const skillPath = join(skillsRoot, skillName, "SKILL.md");
		const content = readFileSync(skillPath, "utf8");
		const normalized = normalizeFrontmatter(content);
		if (normalized !== content) writeFileSync(skillPath, normalized, "utf8");
	}
}

function normalizedTextHash(path) {
	return createHash("sha256")
		.update(readFileSync(path, "utf8").replaceAll("\r\n", "\n"))
		.digest("hex");
}

function assertPathWithin(root, path, label) {
	const relativePath = relative(root, path);
	if (
		relativePath === "" ||
		relativePath === ".." ||
		relativePath.startsWith(`..${sep}`)
	) {
		throw new Error(`${label} must resolve inside ${root}: ${path}`);
	}
}

function readOverrides() {
	const manifest = readJson(overrideManifestPath);
	if (!Array.isArray(manifest.overrides)) {
		throw new Error("Expo override manifest must contain an overrides array");
	}
	return manifest.overrides;
}

function resolveOverride(override, catalogRoot, skillsRoot, skillNames) {
	if (
		typeof override?.target !== "string" ||
		typeof override.source !== "string" ||
		!/^[a-f0-9]{64}$/.test(override.upstreamSha256)
	) {
		throw new Error(
			"Expo override entries require target, source, and SHA-256",
		);
	}

	const target = resolve(catalogRoot, override.target);
	assertPathWithin(skillsRoot, target, "Expo override target");
	const skillName = relative(skillsRoot, target).split(sep)[0];
	if (!skillNames.includes(skillName)) {
		throw new Error(`Expo override targets unmanaged skill ${skillName}`);
	}

	const source = resolve(expoPatchRoot, override.source);
	assertPathWithin(overrideFilesRoot, source, "Expo override source");
	if (!existsSync(source)) {
		throw new Error(`Expo override source does not exist: ${source}`);
	}
	if (!existsSync(target)) {
		throw new Error(`Expo override target does not exist upstream: ${target}`);
	}
	if (!lstatSync(source).isFile() || !lstatSync(target).isFile()) {
		throw new Error("Expo override sources and targets must be regular files");
	}

	const realSource = realpathSync(source);
	const realTarget = realpathSync(target);
	assertPathWithin(
		realpathSync(overrideFilesRoot),
		realSource,
		"Real Expo override source",
	);
	assertPathWithin(
		realpathSync(skillsRoot),
		realTarget,
		"Real Expo override target",
	);

	return { source: realSource, target: realTarget };
}

function applyCheckedOverrides(catalogRoot, skillsRoot, skillNames) {
	const seenTargets = new Set();
	for (const override of readOverrides()) {
		const { source, target } = resolveOverride(
			override,
			catalogRoot,
			skillsRoot,
			skillNames,
		);
		if (seenTargets.has(target)) {
			throw new Error(`Duplicate Expo override target: ${override.target}`);
		}
		seenTargets.add(target);

		const upstreamHash = normalizedTextHash(target);
		if (upstreamHash !== override.upstreamSha256) {
			throw new Error(
				`Upstream changed checked override ${override.target}. Expected ${override.upstreamSha256}, received ${upstreamHash}; reconcile the upstream file before updating.`,
			);
		}
		cpSync(source, target);
	}
}

function validateInstalledOverrides(skillNames) {
	for (const override of readOverrides()) {
		const { source, target } = resolveOverride(
			override,
			projectRoot,
			projectSkillsRoot,
			skillNames,
		);
		if (normalizedTextHash(source) !== normalizedTextHash(target)) {
			throw new Error(
				`Installed Expo override does not match its source: ${override.target}`,
			);
		}
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
		if (!rawTarget || /^[a-z][a-z0-9+.-]*:/i.test(rawTarget)) continue;
		const target = resolve(dirname(skillPath), rawTarget);
		if (!existsSync(target)) {
			throw new Error(`${skillName}: local link does not exist: ${rawTarget}`);
		}
	}
}

function validateCatalog(skillsRoot, expoEntries) {
	if (expoEntries.length === 0)
		throw new Error("Expo returned an empty catalog");
	for (const [skillName, entry] of expoEntries) {
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
}

function mergeSkillLocks(currentLock, upstreamLock) {
	const currentNonExpoEntries = Object.entries(currentLock.skills).filter(
		([, entry]) => entry.source !== EXPO_SOURCE,
	);
	const currentNonExpoNames = new Set(
		currentNonExpoEntries.map(([name]) => name),
	);
	const upstreamExpoEntries = getExpoEntries(upstreamLock);
	for (const [name] of upstreamExpoEntries) {
		if (currentNonExpoNames.has(name)) {
			throw new Error(
				`Expo skill ${name} conflicts with an existing non-Expo skill`,
			);
		}
	}

	const mergedEntries = [...currentNonExpoEntries, ...upstreamExpoEntries].sort(
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

function fetchAndCompose() {
	const cacheRoot = join(projectRoot, "node_modules", ".cache");
	mkdirSync(cacheRoot, { recursive: true });
	const fetchRoot = mkdtempSync(join(cacheRoot, "dayova-expo-skills-"));
	const cliTempRoot = join(fetchRoot, ".tmp");
	const npmCacheRoot = join(fetchRoot, ".npm-cache");
	mkdirSync(cliTempRoot, { recursive: true });
	mkdirSync(npmCacheRoot, { recursive: true });
	try {
		run("git", ["init", "--quiet"], { cwd: fetchRoot });
		console.log("Fetching the latest Expo skill catalog...");
		run(
			npxCommand,
			[
				"skills@latest",
				"add",
				EXPO_SOURCE,
				"--skill",
				"*",
				"--agent",
				"codex",
				"-y",
				"--copy",
			],
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
		const expoEntries = getExpoEntries(upstreamLock);
		const skillNames = expoEntries.map(([name]) => name);
		const skillsRoot = join(fetchRoot, ".agents", "skills");

		normalizeCatalog(skillsRoot, skillNames);
		run("git", ["apply", "--check", "--whitespace=nowarn", patchPath], {
			cwd: fetchRoot,
		});
		run("git", ["apply", "--whitespace=nowarn", patchPath], {
			cwd: fetchRoot,
		});
		applyCheckedOverrides(fetchRoot, skillsRoot, skillNames);
		validateCatalog(skillsRoot, expoEntries);

		return { expoEntries, fetchRoot, skillsRoot, upstreamLock };
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
			`Refusing to overwrite uncommitted Expo skill changes:\n${status}`,
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

	const backupRoot = mkdtempSync(join(projectRoot, ".expo-skills-backup-"));
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

		run(pnpmCommand, ["typecheck"], { cwd: projectRoot });
		run(pnpmCommand, ["test"], { cwd: projectRoot });
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
		throw new Error(`Expo skill update ${outcome}: ${error.message}`);
	} finally {
		cleanupTree(backupRoot);
	}
}

let fetchRoot;
try {
	if (!existsSync(patchPath))
		throw new Error(`Missing patch queue: ${patchPath}`);
	if (!existsSync(overrideManifestPath)) {
		throw new Error(`Missing override manifest: ${overrideManifestPath}`);
	}
	if (!existsSync(projectLockPath)) throw new Error("Missing skills-lock.json");

	const currentLockText = readFileSync(projectLockPath, "utf8");
	const currentLock = JSON.parse(currentLockText);
	const currentExpoEntries = getExpoEntries(currentLock);
	const currentNames = currentExpoEntries.map(([name]) => name);
	if (args.has("--validate-current")) {
		validateInstalledOverrides(currentNames);
		validateCatalog(projectSkillsRoot, currentExpoEntries);
		console.log(`Validated ${currentNames.length} installed Expo skills.`);
		process.exit(0);
	}
	const composed = fetchAndCompose();
	fetchRoot = composed.fetchRoot;
	const composedNames = composed.expoEntries.map(([name]) => name);
	const mergedLock = mergeSkillLocks(currentLock, composed.upstreamLock);
	const composedLockText = serializeLike(currentLockText, mergedLock);
	const changes = findChanges(
		currentNames,
		composedNames,
		composed.skillsRoot,
		currentLockText !== composedLockText,
	);

	if (args.has("--check")) {
		if (changes.length > 0) {
			console.error("Expo skill composition is out of date:");
			for (const change of changes) console.error(`  - ${change}`);
			process.exitCode = 1;
		} else {
			console.log(
				`Expo skill composition is current (${composedNames.length} skills validated).`,
			);
		}
	} else if (changes.length === 0) {
		console.log(
			`Expo skill composition is already current (${composedNames.length} skills validated).`,
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
			`Updated and verified ${composedNames.length} composed Expo skills. Review the Git diff before committing.`,
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
