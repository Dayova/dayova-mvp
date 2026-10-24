import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { CLERK_ISSUER } from "./ci-preview-config.cjs";

const PROJECT_ID = 1984398;
const API = "https://api.convex.dev/v1";
const DIRECTORY = ".maestro/artifacts/ci";

// Management HTTP and the official CLI are the external provisioning boundaries.
export async function provisionPreview({
	env = process.env,
	request = fetch,
	execute = (command, args, options) =>
		spawnSync(command, args, { ...options, encoding: "utf8" }),
	directory = DIRECTORY,
	nonce = randomBytes(6).toString("hex"),
	now = Date.now(),
} = {}) {
	rmSync(join(directory, "convex-preview.json"), { force: true });
	const key = env.CONVEX_CI_PREVIEW_DEPLOY_KEY;
	if (!/^preview:[a-z0-9-]+:[a-z0-9-]+\|.+$/.test(key ?? ""))
		throw new Error(
			"CONVEX_CI_PREVIEW_DEPLOY_KEY must be a project-scoped preview deploy key; shared/prod keys are rejected.",
		);
	const git = execute("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
	const sourceSha = git.stdout?.trim();
	if (
		git.status !== 0 ||
		!/^[a-f0-9]{40}$/.test(sourceSha ?? "") ||
		(env.CI_SOURCE_SHA &&
			env.CI_SOURCE_SHA !== "unavailable" &&
			env.CI_SOURCE_SHA !== sourceSha)
	)
		throw new Error("CI preview source does not match the checked-out commit.");
	if (!/^[a-f0-9]{12}$/.test(nonce))
		throw new Error("Invalid CI preview nonce.");
	const previewName = `ci-${sourceSha.slice(0, 12)}-${nonce}`;
	const expiresAt = now + 24 * 60 * 60 * 1000;
	const response = await request(
		`${API}/projects/${PROJECT_ID}/create_deployment`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				type: "preview",
				reference: previewName,
				region: "aws-eu-west-1",
				isDefault: false,
				expiresAt,
			}),
			signal: AbortSignal.timeout(30_000),
		},
	);
	if (!response.ok)
		throw new Error(
			`Convex preview creation failed (HTTP ${response.status}).`,
		);
	const deployment = await response.json();
	if (
		deployment.deploymentType !== "preview" ||
		deployment.projectId !== PROJECT_ID ||
		deployment.reference !== `preview/${previewName}` ||
		!/^[a-z0-9-]+$/.test(deployment.name) ||
		deployment.region !== "aws-eu-west-1" ||
		deployment.expiresAt !== expiresAt
	)
		throw new Error(
			"Convex returned a deployment outside this run's isolated preview scope.",
		);
	const url = `https://${deployment.name}.eu-west-1.convex.cloud`;
	mkdirSync(directory, { recursive: true });
	const capture = join(directory, "convex-preview-url.json");
	rmSync(capture, { force: true });
	const privateDirectory = mkdtempSync(
		join(tmpdir(), "dayova-convex-preview-"),
	);
	const selection = join(privateDirectory, "deployment.env");
	try {
		writeFileSync(selection, `CONVEX_DEPLOY_KEY=${key}\n`, { mode: 0o600 });
		const cliEnv = {
			...env,
			CONVEX_DEPLOY_KEY: key,
			CI_PREVIEW_CAPTURE_FILE: capture,
		};
		for (const name of [
			"CONVEX_DEPLOYMENT",
			"CONVEX_SELF_HOSTED_URL",
			"CONVEX_SELF_HOSTED_ADMIN_KEY",
			"CONVEX_CI_PREVIEW_DEPLOY_KEY",
		])
			delete cliEnv[name];
		const run = (args) => {
			const result = execute(
				process.execPath,
				[
					"node_modules/convex/bin/main.js",
					...args,
					"--env-file",
					selection,
					"--preview-name",
					previewName,
				],
				{ env: cliEnv, encoding: "utf8", timeout: 10 * 60_000 },
			);
			if (result.status !== 0) {
				const raw = `${result.stderr ?? ""}\n${result.stdout ?? ""}`;
				const detail = raw
					.replaceAll(key, "[redacted]")
					.replaceAll(key.split("|")[1], "[redacted]");
				writeFileSync(join(directory, "preview-deploy.log"), detail);
				console.error(detail.slice(-2500));
				throw new Error(
					"Convex preview CLI configuration/compilation/deployment failed; no native tests may start.",
				);
			}
			return result.stdout ?? "";
		};
		// Convex applies project defaults on creation. Remove every inherited provider
		// setting before any function code is deployed or a synthetic user is created.
		const allowed = {
			CLERK_JWT_ISSUER_DOMAIN: CLERK_ISSUER,
			NOTION_CRM_MODE: "off",
			NOTION_CRM_DELETION_MODE: "off",
			LANGFUSE_ENABLED: "false",
		};
		const names = run(["env", "list", "--names-only"])
			.trim()
			.split(/\r?\n/)
			.filter(Boolean);
		if (names.some((name) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(name)))
			throw new Error("Unexpected Convex preview environment response.");
		for (const name of names)
			if (!Object.hasOwn(allowed, name)) run(["env", "remove", name]);
		for (const [name, value] of Object.entries(allowed))
			run(["env", "set", name, value]);
		run([
			"deploy",
			"--codegen",
			"disable",
			"--typecheck",
			"enable",
			"--cmd-url-env-var-name",
			"EXPO_PUBLIC_CONVEX_URL",
			"--cmd",
			"node scripts/ci-convex-preview.mjs capture",
		]);
		const captured = JSON.parse(readFileSync(capture, "utf8"));
		if (captured.url !== url)
			throw new Error(
				"The deployed backend URL differs from the provisioned preview.",
			);
		const result = {
			url,
			previewName,
			sourceSha,
			deploymentName: deployment.name,
			projectId: PROJECT_ID,
			expiresAt,
		};
		writeFileSync(
			join(directory, "convex-preview.json"),
			JSON.stringify(result, null, 2),
		);
		return result;
	} finally {
		rmSync(privateDirectory, { recursive: true, force: true });
	}
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	if (process.argv[2] === "capture") {
		if (
			!process.env.CI_PREVIEW_CAPTURE_FILE ||
			!process.env.EXPO_PUBLIC_CONVEX_URL
		)
			throw new Error("Missing Convex CLI URL handoff.");
		writeFileSync(
			process.env.CI_PREVIEW_CAPTURE_FILE,
			JSON.stringify({ url: process.env.EXPO_PUBLIC_CONVEX_URL }),
		);
	} else {
		await provisionPreview();
		console.log(
			"Commit-matched Convex preview deployed; public provenance saved.",
		);
	}
}
