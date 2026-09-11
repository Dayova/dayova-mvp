export const GOVERNANCE_SCHEMA_VERSION = 1;
export const GOVERNANCE_REVIEW_DATE = "2026-08-09";
export const DAYOVA_REPOSITORY_SOURCE = "dayova/dayova-mvp";
export const AGENT_SYSTEM_OWNER = "Jakob Rössner";

export const canonicalSurfaces = {
	knowledge: {
		name: "Notion",
		url: "https://app.notion.com/p/3b42e87228bf816e9343c3fc33fa73ca",
	},
	work: {
		name: "Linear",
		url: "https://linear.app/dayova/issue/DAY-332/codify-dayovas-agent-system-architecture-and-skill-governance-contract",
	},
	codeAndEvidence: {
		name: "GitHub",
		url: "https://github.com/Dayova/dayova-mvp",
	},
};

export const authorizationClasses = {
	"read-only": {
		mutationClass: "read-only-or-ephemeral",
		authorization:
			"May read task-scoped sources and create temporary local analysis artifacts. Persistent or external writes require a separately authorized workflow.",
		systems: {
			read: ["repository", "task-scoped linked systems"],
			write: ["temporary local artifacts"],
		},
	},
	"repository-write": {
		mutationClass: "repository-scoped",
		authorization:
			"May change the requested repository scope and complete reviewed branch/PR delivery. External and production writes require explicit workflow authority.",
		systems: {
			read: ["repository", "task-scoped linked documentation"],
			write: ["repository", "GitHub branch and pull request"],
		},
	},
	"repository-write-conditional": {
		mutationClass: "read-only-by-default-repository-write-on-request",
		authorization:
			"Defaults to analysis or an inline result. Repository and GitHub writes are allowed only when the user or owning workflow explicitly requests a durable artifact or implementation.",
		systems: {
			read: ["repository", "task-scoped linked documentation"],
			write: [
				"temporary local artifacts",
				"repository and GitHub branch/pull request only for an explicitly requested durable artifact",
			],
		},
	},
	"repository-runtime-write-conditional": {
		mutationClass:
			"read-only-by-default-repository-and-local-runtime-write-on-request",
		authorization:
			"Defaults to diagnosis, review, or design. Repository delivery and local runtime mutation are allowed only when the user or owning workflow requests implementation or rendered verification.",
		systems: {
			read: [
				"repository",
				"task-scoped linked documentation",
				"local development runtime",
			],
			write: [
				"temporary local artifacts",
				"local development runtime for requested verification",
				"repository and GitHub branch/pull request only for requested implementation",
			],
		},
	},
	"tracker-write": {
		mutationClass: "executable-work-system",
		authorization:
			"May write Linear only when the user invokes or authorizes the tracker workflow. Search and preserve existing work before creating or replacing it.",
		systems: {
			read: ["repository", "Linear", "linked Notion context"],
			write: ["Linear", "repository when the workflow produces owned files"],
		},
	},
	"external-service-write": {
		mutationClass: "external-development-service",
		authorization:
			"May mutate the named development service only within the user's requested operation. Persistent access, credentials, production, or publication needs its own explicit authority.",
		systems: {
			read: ["repository", "named Expo or EAS service"],
			write: ["repository", "named Expo or EAS development service"],
		},
	},
	"external-service-write-conditional": {
		mutationClass: "read-only-by-default-external-development-write-on-request",
		authorization:
			"Queries and interpretation are read-only. Repository or development-service mutation is allowed only when the user requests setup, instrumentation, or another named change.",
		systems: {
			read: ["repository", "named Expo or EAS service"],
			write: [
				"temporary local artifacts",
				"repository or named Expo/EAS development service only for a requested change",
			],
		},
	},
	"ephemeral-evaluation": {
		mutationClass: "local-ephemeral-with-opt-in-external-publication",
		authorization:
			"May create isolated evaluation workspaces, caches, and local runtime state. It may not change the repository; external publication requires the user's explicit opt-in and temporary global configuration must be restored.",
		systems: {
			read: ["repository", "local toolchains", "evaluation caches"],
			write: [
				"isolated temporary evaluation workspaces and caches",
				"local simulator, emulator, or browser runtime",
				"external result artifact only after explicit publication opt-in",
			],
		},
	},
	"production-deploy": {
		mutationClass: "production-or-publication",
		authorization:
			"Requires an explicit deployment or publication request and all platform confirmations. Preserve draft/non-production state when authority or validation is incomplete.",
		systems: {
			read: ["repository", "EAS", "target store or hosting service"],
			write: ["EAS", "target store or hosting service", "GitHub evidence"],
		},
	},
	"external-feedback": {
		mutationClass: "external-feedback-or-telemetry",
		authorization:
			"Requires the user's explicit request before submitting feedback or changing telemetry state. Keep telemetry off unless the user opts in.",
		systems: {
			read: ["repository", "local telemetry state"],
			write: ["Expo feedback endpoint or local telemetry state"],
		},
	},
	"agent-system-governance": {
		mutationClass: "repository-governance",
		authorization:
			"May change the requested repository governance surfaces and complete reviewed delivery. Notion, Linear, plugin, secret, and production changes require authority from their owning workflow.",
		systems: {
			read: ["repository", "Linear", "Notion", "GitHub", "upstream sources"],
			write: [
				"repository",
				"GitHub branch and pull request",
				"Linear or Notion only when the owning task authorizes reconciliation",
			],
		},
	},
};

export const evalSuites = {
	"catalog-contract": {
		kind: "structural",
		command: "pnpm skills:validate",
		owner: "DAY-332",
	},
	"matt-composition": {
		kind: "structural",
		command: "pnpm skills:validate:matt",
		owner: "docs/agents/matt-pocock-skills.md",
	},
	"expo-composition": {
		kind: "structural",
		command: "pnpm skills:validate:expo",
		owner: "docs/agents/expo-skills.md",
	},
	"convex-source-policy": {
		kind: "structural",
		command: "pnpm skills:validate:catalog",
		owner: "DAY-226",
	},
	"dayova-local-contract": {
		kind: "structural",
		command: "pnpm skills:validate:catalog",
		owner: "DAY-332",
	},
	"catalog-routing": {
		kind: "behavioral",
		status: "planned",
		owner: "DAY-227",
	},
	"maintain-agent-system-routing": {
		kind: "behavioral-and-mutation-safety",
		fixture: ".agents/evals/maintain-dayova-agent-system.json",
		result: ".agents/evals/maintain-dayova-agent-system.forward-test.json",
		owner: "DAY-332",
	},
};

const sourceDefaults = {
	"mattpocock/skills": {
		skillRationale:
			"its curated engineering workflow materially improves repeatable repository work",
		overrideRationale:
			"Compose upstream through Dayova's patch queue and Codex/Linear metadata overlay; keep source hashes unchanged.",
		evalSuite: ["catalog-contract", "matt-composition", "catalog-routing"],
	},
	"expo/skills": {
		skillRationale:
			"Dayova is an Expo application and the capability needs version-aware Expo guidance",
		overrideRationale:
			"Compose upstream through Dayova's patch and checksum-guarded replacement policy.",
		evalSuite: ["catalog-contract", "expo-composition", "catalog-routing"],
	},
	"get-convex/agent-skills": {
		skillRationale:
			"Dayova uses Convex and the capability needs current backend-specific contracts",
		overrideRationale:
			"Preserve the installed content pin without a local text overlay until DAY-226 defines Convex composition.",
		evalSuite: ["catalog-contract", "convex-source-policy", "catalog-routing"],
	},
	[DAYOVA_REPOSITORY_SOURCE]: {
		skillRationale:
			"the workflow encodes a Dayova-specific repository contract with no suitable upstream owner",
		overrideRationale:
			"Dayova owns the source directly; upstream override policy does not apply.",
		evalSuite: ["catalog-contract", "dayova-local-contract", "catalog-routing"],
	},
};

function defineSource({
	name,
	pin,
	inclusionRationale,
	positiveTrigger,
	negativeTrigger,
	artifacts,
	retirementCriteria,
}) {
	return {
		name,
		pin,
		owner: AGENT_SYSTEM_OWNER,
		inclusionRationale,
		triggerBoundary: {
			positive: positiveTrigger,
			negative: negativeTrigger,
		},
		invocation: "not-invocable",
		inputs: [
			"approved source adoption or maintenance issue",
			"exact source input",
		],
		outputs: ["reviewable composed repository catalog"],
		artifacts,
		systems: {
			read: [name, "repository", "Linear", "Notion decision record"],
			write: ["repository", "GitHub review evidence"],
		},
		authorizationClass: "agent-system-governance",
		overrideRationale: sourceDefaults[name].overrideRationale,
		evalSuite: [...sourceDefaults[name].evalSuite],
		lastReviewed: GOVERNANCE_REVIEW_DATE,
		retirementCriteria,
	};
}

export const sourceGovernance = {
	"mattpocock/skills": defineSource({
		name: "mattpocock/skills",
		pin: {
			kind: "per-skill-content-sha256",
			location: "skills-lock.json",
		},
		inclusionRationale:
			"Curated engineering workflows used across Dayova repository work.",
		positiveTrigger:
			"A Matt release or an approved change to the curated Matt workflow set, patch queue, metadata, or composition policy.",
		negativeTrigger:
			"Ordinary use of an installed Matt skill or adoption of an unreviewed upstream skill.",
		artifacts: [
			".agents/skills/<curated-matt-skill>",
			"patches/matt-pocock-skills/dayova.patch",
			"skills-lock.json",
		],
		retirementCriteria:
			"Retire the source when Dayova no longer maintains any distinct Matt workflow or cannot pin, compose, and evaluate it safely.",
	}),
	"expo/skills": defineSource({
		name: "expo/skills",
		pin: {
			kind: "per-skill-content-sha256",
			location: "skills-lock.json",
		},
		inclusionRationale:
			"Curated framework and EAS workflows required by Dayova's Expo application.",
		positiveTrigger:
			"An Expo skill release or an approved change to the curated Expo set, patch queue, replacements, metadata, or composition policy.",
		negativeTrigger:
			"Ordinary Expo application work or direct installation over the composed catalog.",
		artifacts: [
			".agents/skills/<curated-expo-skill>",
			"patches/expo-skills",
			"skills-lock.json",
		],
		retirementCriteria:
			"Retire the source when Dayova no longer uses Expo/EAS or another pinned, evaluated source owns every retained workflow.",
	}),
	"get-convex/agent-skills": defineSource({
		name: "get-convex/agent-skills",
		pin: {
			kind: "per-skill-content-sha256",
			location: "skills-lock.json",
		},
		inclusionRationale:
			"Curated backend workflows required by Dayova's Convex implementation.",
		positiveTrigger:
			"An approved Convex skill adoption or maintenance decision under DAY-226.",
		negativeTrigger:
			"Ordinary Convex code work or an unapproved upstream refresh.",
		artifacts: [".agents/skills/<curated-convex-skill>", "skills-lock.json"],
		retirementCriteria:
			"Retire the source when Dayova no longer uses Convex or replaces every retained capability with another governed owner.",
	}),
	[DAYOVA_REPOSITORY_SOURCE]: defineSource({
		name: DAYOVA_REPOSITORY_SOURCE,
		pin: {
			kind: "git-history",
			location: "repository commit containing the skill",
		},
		inclusionRationale:
			"Dayova-owned workflows whose repository behavior cannot be delegated to an upstream catalog.",
		positiveTrigger:
			"An approved creation, change, evaluation, or retirement of a Dayova-owned repository workflow.",
		negativeTrigger:
			"Company handbook content, personal/global mechanics, or event-scoped Linear Agent and Luma operations.",
		artifacts: [".agents/skills/<dayova-skill>", "Git history"],
		retirementCriteria:
			"Retire an owned source surface when no Dayova-specific repository workflow remains distinct and evaluated.",
	}),
};

const explicitSkills = new Set([
	"ask-matt",
	"grill-me",
	"grill-with-docs",
	"handoff",
	"implement",
	"improve-codebase-architecture",
	"setup-matt-pocock-skills",
	"teach",
	"to-spec",
	"to-tickets",
	"triage",
	"wayfinder",
	"writing-great-skills",
]);

const skillDefinitions = {
	"mattpocock/skills": [
		[
			"ask-matt",
			"The user explicitly asks which repository engineering skill or flow fits.",
			"A named workflow is already selected or ordinary implementation is requested.",
			"read-only",
		],
		[
			"code-review",
			"Review a branch or change set against repository standards and its originating spec.",
			"Review product/UX quality, investigate a bug, or implement fixes.",
			"read-only",
		],
		[
			"codebase-design",
			"Design or improve module boundaries, depth, interfaces, or test seams.",
			"Make a routine local edit whose module boundary is already settled.",
			"read-only",
		],
		[
			"diagnosing-bugs",
			"Diagnose a hard bug, failure, regression, or performance problem.",
			"Implement a known fix without a diagnosis phase.",
			"read-only",
		],
		[
			"domain-modeling",
			"Define stable domain language, contracts, context docs, or ADRs.",
			"Change code without a domain-language or architecture decision.",
			"repository-write",
		],
		[
			"grill-me",
			"The user explicitly requests a relentless interview about a plan or design.",
			"The user asks for implementation, explanation, or a bounded clarification.",
			"read-only",
		],
		[
			"grill-with-docs",
			"The user explicitly requests a grilling session that also maintains decision documents.",
			"Stress-testing is not requested or no durable agent-facing document should change.",
			"repository-write",
		],
		[
			"grilling",
			"The user asks to grill or aggressively stress-test an idea, plan, or decision.",
			"The user asks for a normal review, advice, or implementation.",
			"read-only",
		],
		[
			"handoff",
			"The user explicitly requests a durable handoff for another agent.",
			"The current task can continue or only a conversational summary is needed.",
			"repository-write",
		],
		[
			"implement",
			"The user explicitly invokes the implementation workflow for an existing spec or ticket set.",
			"The task is exploratory, diagnostic, review-only, or lacks approved scope.",
			"repository-write",
		],
		[
			"improve-codebase-architecture",
			"The user explicitly asks for a broad architectural scan and interactive improvement report.",
			"A targeted module change or ordinary code review is requested.",
			"repository-write-conditional",
		],
		[
			"prototype",
			"Build a throwaway prototype to answer an unresolved design or state-model question.",
			"Implement a settled production decision or preserve prototype code by default.",
			"repository-write",
		],
		[
			"research",
			"Investigate a question using current, high-trust primary sources and record citations.",
			"Answer from stable repository facts or implement an already-decided change.",
			"repository-write-conditional",
		],
		[
			"setup-matt-pocock-skills",
			"The user explicitly requests initial setup or reconfiguration of Matt engineering workflows.",
			"The repository is configured and only one skill or source update is needed.",
			"tracker-write",
		],
		[
			"tdd",
			"The user requests test-first work, red-green-refactor, or integration tests.",
			"The task does not request test-first delivery and existing validation is sufficient.",
			"repository-write",
		],
		[
			"teach",
			"The user explicitly asks for a workspace-based lesson or teaching mission.",
			"The user wants the task solved rather than a learning workflow.",
			"repository-write",
		],
		[
			"to-spec",
			"The user explicitly asks to synthesize discussed decisions into a published spec.",
			"The discussion is unresolved or the user asks for implementation instead of publication.",
			"tracker-write",
		],
		[
			"to-tickets",
			"The user explicitly asks to decompose an approved plan into dependency-aware Linear work.",
			"The work is one bounded task or the plan is not approved.",
			"tracker-write",
		],
		[
			"triage",
			"The user explicitly invokes issue or external-PR triage through Dayova's state machine.",
			"Implement, diagnose, or review already-triaged work.",
			"tracker-write",
		],
		[
			"wayfinder",
			"The user explicitly asks to map work too large for one session into decision tickets.",
			"The task is bounded to one session or already has an approved execution plan.",
			"tracker-write",
		],
		[
			"writing-great-skills",
			"The user explicitly invokes the current Matt reference while writing or editing a skill.",
			"Write ordinary documentation or code that is not consumed as agent instruction.",
			"read-only",
		],
	],
	"get-convex/agent-skills": [
		[
			"convex",
			"Route a general or underspecified Convex request to the correct project workflow.",
			"A specific Convex specialist workflow is already clear.",
			"read-only",
		],
		[
			"convex-create-component",
			"Build a reusable isolated Convex component or app-facing backend module.",
			"Add an ordinary project-local query, mutation, or schema field.",
			"repository-write",
		],
		[
			"convex-migration-helper",
			"Plan or implement a breaking schema change, backfill, or zero-downtime migration.",
			"Make a backward-compatible schema addition with no data migration.",
			"repository-write-conditional",
		],
		[
			"convex-performance-audit",
			"Audit Convex read amplification, subscriptions, contention, limits, or slow functions.",
			"Implement unrelated Convex features or perform a generic code review.",
			"read-only",
		],
		[
			"convex-quickstart",
			"Create or add the first Convex setup, provider, environment, or dev run.",
			"Work in an already-configured Convex project on a specific capability.",
			"repository-write",
		],
		[
			"convex-setup-auth",
			"Set up authentication, identity mapping, protected functions, users, or roles for Convex.",
			"Change UI-only login presentation or unrelated authorization systems.",
			"repository-write",
		],
	],
	"expo/skills": [
		[
			"eas-app-stores",
			"Build, submit, release, version, or manage store metadata for a production Expo app.",
			"Deploy Expo web/API hosting or build an internal development client.",
			"production-deploy",
		],
		[
			"eas-hosting",
			"Deploy an Expo website or API route and manage its hosting environment.",
			"Build or submit a native app-store release.",
			"production-deploy",
		],
		[
			"eas-observe",
			"Add, query, or interpret EAS Observe instrumentation and metrics.",
			"Use another analytics provider or investigate performance with no EAS Observe surface.",
			"external-service-write-conditional",
		],
		[
			"eas-simulator",
			"Run, control, or capture a remote EAS simulator when the request needs that service.",
			"Use a local macOS simulator or emulator that is available and sufficient.",
			"external-service-write",
		],
		[
			"eas-update-insights",
			"Read health, adoption, crash, or payload metrics for a published EAS Update.",
			"Publish an update or diagnose unrelated application behavior.",
			"read-only",
		],
		[
			"eas-workflows",
			"Create or change EAS workflow YAML and Expo/EAS CI pipelines.",
			"Configure a non-EAS CI workflow with no EAS integration.",
			"repository-write",
		],
		[
			"expo-app-clip",
			"Add or change an iOS App Clip target, AASA contract, or invocation path.",
			"Implement a normal app deep link with no App Clip target.",
			"repository-write",
		],
		[
			"expo-brownfield",
			"Embed Expo or React Native into an existing Swift or Kotlin application.",
			"Work in a normal Expo-first application or migrate a web app.",
			"repository-write",
		],
		[
			"expo-data-fetching",
			"Implement or debug a network request, API call, cache, offline behavior, or route loader.",
			"Change local state or UI with no data-fetching boundary.",
			"repository-runtime-write-conditional",
		],
		[
			"expo-dev-client",
			"Build or distribute an Expo development client for internal testing.",
			"Ship a production store release or use Expo Go without native dependencies.",
			"external-service-write",
		],
		[
			"expo-dom",
			"Use Expo DOM components to run or incrementally reuse web code on native.",
			"Migrate an entire web application or build ordinary native components.",
			"repository-write",
		],
		[
			"expo-examples",
			"Find and adapt the canonical version-matched Expo example for an integration.",
			"Implement a capability with no relevant official example.",
			"repository-write-conditional",
		],
		[
			"expo-module",
			"Create or modify an Expo native module, native view, shared object, or config plugin.",
			"Build JavaScript-only features or use an existing native package unchanged.",
			"repository-write",
		],
		[
			"expo-native-ui",
			"Build or review native-feeling Expo UI with platform controls, effects, media, or motion.",
			"Change routing, data fetching, or a custom native module without UI design work.",
			"repository-runtime-write-conditional",
		],
		[
			"expo-project-structure",
			"Lay out, scaffold, or decide where a file belongs in a new Expo Router project.",
			"Restructure an established project merely to match a template.",
			"repository-write-conditional",
		],
		[
			"expo-router",
			"Implement or debug Expo Router navigation, routes, stacks, tabs, modals, headers, or search.",
			"Build screen content whose navigation contract is unchanged.",
			"repository-runtime-write-conditional",
		],
		[
			"expo-skill-eval",
			"Evaluate an Expo skill's triggering, generated code, and runtime rendering on supported targets.",
			"Run normal application tests or review a non-Expo skill.",
			"ephemeral-evaluation",
		],
		[
			"expo-skill-feedback",
			"Submit requested Expo skill/framework feedback or explicitly change telemetry opt-in state.",
			"Silently send telemetry or report an ordinary application bug.",
			"external-feedback",
		],
		[
			"expo-tailwind-setup",
			"Set up Tailwind CSS v4 with react-native-css and NativeWind v5 in Expo.",
			"Maintain this repository's existing NativeWind v4 configuration without an upgrade decision.",
			"repository-write",
		],
		[
			"expo-ui",
			"Build or review @expo/ui universal, SwiftUI, or Jetpack Compose component trees.",
			"Build ordinary React Native UI, navigation, or a custom native module.",
			"repository-runtime-write-conditional",
		],
		[
			"expo-upgrade",
			"Upgrade the Expo SDK or resolve dependency compatibility caused by an SDK upgrade.",
			"Perform routine dependency updates unrelated to Expo SDK compatibility.",
			"repository-write",
		],
		[
			"expo-web-to-native",
			"Migrate an existing React website into a native Expo application end to end.",
			"Reuse one web surface through Expo DOM or build a new Expo-native app.",
			"repository-write",
		],
	],
	[DAYOVA_REPOSITORY_SOURCE]: [
		[
			"dayova-product-design",
			"Design, substantially redesign, critique, or resolve the interaction structure of a Dayova UI surface.",
			"Implement an already-settled UI detail or change non-product infrastructure.",
			"repository-runtime-write-conditional",
		],
		[
			"inspect-video-evidence",
			"Inspect complete video or screen-recording evidence for temporal claims, diagnosis, or comparison.",
			"Treat a thumbnail, poster frame, or isolated screenshot as temporal evidence.",
			"read-only",
		],
		[
			"maintain-dayova-agent-system",
			"Create, update, review, or retire repository skills, agent instructions, composition, routing, authorization, or evaluations.",
			"Do ordinary product/code work, create a personal skill, or run event-scoped Linear Agent/Luma operations without a repository contract change.",
			"agent-system-governance",
		],
	],
};

function pinForSkill(source, name) {
	if (source === DAYOVA_REPOSITORY_SOURCE) {
		return {
			kind: "git-history",
			location: `.agents/skills/${name}`,
		};
	}
	return {
		kind: "per-skill-content-sha256",
		location: `skills-lock.json#skills.${name}.computedHash`,
	};
}

function defineSkill(source, [name, positive, negative, authorizationClass]) {
	const defaults = sourceDefaults[source];
	const authorization = authorizationClasses[authorizationClass];
	const contractPath = `.agents/skills/${name}/SKILL.md`;
	const evalSuite = [...defaults.evalSuite];
	if (name === "maintain-dayova-agent-system") {
		evalSuite.push("maintain-agent-system-routing");
	}

	return {
		name,
		source,
		pin: pinForSkill(source, name),
		owner: AGENT_SYSTEM_OWNER,
		inclusionRationale: `${name} is maintained because ${defaults.skillRationale}.`,
		triggerBoundary: { positive, negative },
		invocation: explicitSkills.has(name) ? "explicit" : "implicit",
		inputs: [
			`Task satisfying this boundary: ${positive}`,
			`Prerequisites and scoped context declared by ${contractPath}`,
		],
		outputs: [`Completion result declared by ${contractPath}`],
		artifacts: [
			`Artifacts declared by ${contractPath}; otherwise the response and validation evidence`,
		],
		systems: {
			read: [...authorization.systems.read],
			write: [...authorization.systems.write],
		},
		authorizationClass,
		overrideRationale: defaults.overrideRationale,
		evalSuite,
		lastReviewed: GOVERNANCE_REVIEW_DATE,
		retirementCriteria:
			"Retire or merge when the positive boundary disappears, another governed workflow owns it, or evaluation evidence no longer justifies its maintenance cost.",
	};
}

export const skillGovernance = Object.fromEntries(
	Object.entries(skillDefinitions).flatMap(([source, definitions]) =>
		definitions.map((definition) => {
			const contract = defineSkill(source, definition);
			return [contract.name, contract];
		}),
	),
);

export const agentSystemGovernance = {
	schemaVersion: GOVERNANCE_SCHEMA_VERSION,
	canonicalSurfaces,
	authorizationClasses,
	evalSuites,
	sources: sourceGovernance,
	skills: skillGovernance,
};
