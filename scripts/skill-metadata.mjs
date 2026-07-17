import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const ALLOWED_FRONTMATTER_KEYS = new Set(["description", "name"]);
const MAX_SKILL_NAME_LENGTH = 64;

function parseYamlDictionary(text, label) {
	let value;
	try {
		value = parseYaml(text);
	} catch (error) {
		throw new Error(`${label}: invalid YAML: ${error.message}`);
	}
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label}: YAML document must be a dictionary`);
	}
	return value;
}

function parseSkillFrontmatter(content, skillName) {
	const frontmatterText = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
	if (!frontmatterText) {
		throw new Error(`${skillName}: missing YAML frontmatter`);
	}

	const frontmatter = parseYamlDictionary(
		frontmatterText,
		`${skillName}: frontmatter`,
	);
	const unexpectedKeys = Object.keys(frontmatter).filter(
		(key) => !ALLOWED_FRONTMATTER_KEYS.has(key),
	);
	if (unexpectedKeys.length > 0) {
		throw new Error(
			`${skillName}: unexpected frontmatter key(s): ${unexpectedKeys.join(", ")}`,
		);
	}

	if (typeof frontmatter.name !== "string") {
		throw new Error(`${skillName}: frontmatter name must be a string`);
	}
	const name = frontmatter.name.trim();
	if (!name) throw new Error(`${skillName}: frontmatter name cannot be empty`);
	if (!/^[a-z0-9-]+$/.test(name)) {
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
	if (!description) {
		throw new Error(`${skillName}: frontmatter description cannot be empty`);
	}
	if (description.includes("<") || description.includes(">")) {
		throw new Error(`${skillName}: description cannot contain angle brackets`);
	}
	if (description.length > 1024) {
		throw new Error(`${skillName}: description exceeds 1024 characters`);
	}

	return { description, name };
}

export function validateSkill(skillsRoot, skillName) {
	const skillPath = join(skillsRoot, skillName, "SKILL.md");
	if (!existsSync(skillPath)) throw new Error(`${skillName}: missing SKILL.md`);

	const content = readFileSync(skillPath, "utf8");
	parseSkillFrontmatter(content, skillName);

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

export function validateMattLockEntry(skillName, entry) {
	if (entry?.sourceType !== "github") {
		throw new Error(
			`${skillName}: unexpected source type ${entry?.sourceType}`,
		);
	}
	if (!/^[a-f0-9]{64}$/.test(entry?.computedHash ?? "")) {
		throw new Error(`${skillName}: invalid upstream hash`);
	}
}

export function validateOpenAiMetadataForSkill(
	skillsRoot,
	skillName,
	userInvoked,
) {
	const metadataPath = join(skillsRoot, skillName, "agents", "openai.yaml");
	if (!existsSync(metadataPath)) {
		throw new Error(`${skillName}: missing agents/openai.yaml`);
	}
	const metadata = parseYamlDictionary(
		readFileSync(metadataPath, "utf8"),
		`${skillName}: agents/openai.yaml`,
	);
	const allowsImplicitInvocation =
		metadata?.policy?.allow_implicit_invocation !== false;
	if (userInvoked && allowsImplicitInvocation) {
		throw new Error(
			`${skillName}: user-invoked skill must set policy.allow_implicit_invocation: false`,
		);
	}
	if (!userInvoked && !allowsImplicitInvocation) {
		throw new Error(
			`${skillName}: model-invoked skill must not disable implicit invocation`,
		);
	}
}
