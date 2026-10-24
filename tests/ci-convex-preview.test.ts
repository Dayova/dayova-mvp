// @vitest-environment node
import type { SpawnSyncReturns } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { provisionPreview } from "../scripts/ci-convex-preview.mjs";

const sha = "a".repeat(40);
const now = Date.UTC(2026, 9, 23, 20);
const name = "gentle-preview-123";
const url = "https://gentle-preview-123.eu-west-1.convex.cloud";
const key = "preview:dayova:dayova|project-fixture-secret";
function processResult(stdout: string, status = 0): SpawnSyncReturns<string> {
	return { pid: 42, output: [], stdout, stderr: "", status, signal: null };
}
function services(directory: string, fault = "") {
	const deployments: unknown[] = [];
	const environment = new Map([
		["NOTION_CRM_MODE", "live"],
		["EXTERNAL_PROVIDER_KEY", "inherited-fixture-secret"],
	]);
	let deployed = false;
	const request = vi.fn<typeof fetch>(async (input, options) => {
		if (
			typeof input !== "string" ||
			!input.endsWith("/projects/1984398/create_deployment")
		)
			throw Error("Unexpected external service request");
		const body = JSON.parse(String(options?.body));
		deployments.push(body);
		if (fault === "provisioning") return Response.json({}, { status: 403 });
		return Response.json({
			deploymentType: fault === "wrong-scope" ? "prod" : "preview",
			projectId: 1984398,
			reference: `preview/${body.reference}`,
			name,
			region: "aws-eu-west-1",
			expiresAt: body.expiresAt + (fault === "wrong-expiry" ? 1 : 0),
		});
	});
	const execute = vi.fn(
		(
			command: string,
			args: string[],
			options?: { env?: NodeJS.ProcessEnv },
		) => {
			if (command === "git") return processResult(sha);
			expect(options?.env?.CONVEX_DEPLOY_KEY).toBe(key);
			expect(options?.env?.CONVEX_CI_PREVIEW_DEPLOY_KEY).toBeUndefined();
			if (args[1] === "env") {
				if (args[2] === "list")
					return processResult([...environment.keys()].join("\n"));
				if (args[2] === "remove") environment.delete(args[3]);
				if (args[2] === "set") {
					if (fault === "environment")
						return { ...processResult("", 1), stderr: key };
					environment.set(args[3], args[4]);
				}
				return processResult("");
			}
			if (args[1] !== "deploy") throw Error("Unexpected external process");
			deployed = true;
			writeFileSync(
				join(directory, "convex-preview-url.json"),
				JSON.stringify({
					url: fault === "wrong-url" ? "https://other.convex.cloud" : url,
				}),
			);
			return {
				...processResult("", fault === "deploy" ? 1 : 0),
				stderr: fault === "deploy" ? key : "",
			};
		},
	);
	return {
		request,
		execute,
		deployments,
		environment,
		deployed: () => deployed,
	};
}

describe("isolated candidate backend provisioning", () => {
	it("deploys this commit after removing inherited providers and records expiring public provenance", async () => {
		const directory = mkdtempSync(join(tmpdir(), "ci-convex-preview-"));
		try {
			const boundary = services(directory);
			const result = await provisionPreview({
				...boundary,
				directory,
				now,
				nonce: "123456abcdef",
				env: {
					NODE_ENV: "test",
					CONVEX_CI_PREVIEW_DEPLOY_KEY: key,
					CI_SOURCE_SHA: sha,
				},
			});
			expect(result).toEqual({
				url,
				previewName: "ci-aaaaaaaaaaaa-123456abcdef",
				sourceSha: sha,
				deploymentName: name,
				projectId: 1984398,
				expiresAt: Date.UTC(2026, 9, 24, 20),
			});
			expect(boundary.deployments).toEqual([
				{
					type: "preview",
					reference: "ci-aaaaaaaaaaaa-123456abcdef",
					region: "aws-eu-west-1",
					isDefault: false,
					expiresAt: Date.UTC(2026, 9, 24, 20),
				},
			]);
			expect(boundary.environment).toEqual(
				new Map([
					[
						"CLERK_JWT_ISSUER_DOMAIN",
						"https://warm-parrot-13.clerk.accounts.dev",
					],
					["NOTION_CRM_MODE", "off"],
					["NOTION_CRM_DELETION_MODE", "off"],
					["LANGFUSE_ENABLED", "false"],
				]),
			);
			expect(boundary.deployed()).toBe(true);
			const artifact = readFileSync(
				join(directory, "convex-preview.json"),
				"utf8",
			);
			expect(JSON.parse(artifact)).toEqual(result);
			expect(artifact).not.toContain("fixture-secret");
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
	it.each([
		"",
		"prod:production-123|secret",
		"dev:shared-123|secret",
	])("rejects an unsafe deploy credential before service access (%s)", async (credential) => {
		const request = vi.fn<typeof fetch>();
		await expect(
			provisionPreview({
				env: { NODE_ENV: "test", CONVEX_CI_PREVIEW_DEPLOY_KEY: credential },
				request,
			}),
		).rejects.toThrow("project-scoped preview");
		expect(request).not.toHaveBeenCalled();
	});
	it.each([
		"provisioning",
		"wrong-scope",
		"wrong-expiry",
		"environment",
		"deploy",
		"wrong-url",
	])("never publishes success after %s failure", async (fault) => {
		const directory = mkdtempSync(join(tmpdir(), "ci-convex-preview-"));
		try {
			writeFileSync(
				join(directory, "convex-preview.json"),
				JSON.stringify({ url: "https://old.convex.cloud" }),
			);
			const boundary = services(directory, fault);
			await expect(
				provisionPreview({
					...boundary,
					directory,
					now,
					nonce: "123456abcdef",
					env: {
						NODE_ENV: "test",
						CONVEX_CI_PREVIEW_DEPLOY_KEY: key,
						CI_SOURCE_SHA: sha,
					},
				}),
			).rejects.toThrow();
			expect(() =>
				readFileSync(join(directory, "convex-preview.json")),
			).toThrow();
			if (
				["provisioning", "wrong-scope", "wrong-expiry", "environment"].includes(
					fault,
				)
			)
				expect(boundary.deployed()).toBe(false);
			if (["environment", "deploy"].includes(fault)) {
				const log = readFileSync(join(directory, "preview-deploy.log"), "utf8");
				expect(log).not.toContain(key);
				expect(log).not.toContain("project-fixture-secret");
				expect(log).toContain("[redacted]");
			}
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
	it("rejects a different source commit before allocating a backend", async () => {
		const request = vi.fn<typeof fetch>();
		const execute = vi.fn(() => processResult(sha));
		await expect(
			provisionPreview({
				env: {
					NODE_ENV: "test",
					CONVEX_CI_PREVIEW_DEPLOY_KEY: key,
					CI_SOURCE_SHA: "b".repeat(40),
				},
				request,
				execute,
			}),
		).rejects.toThrow("checked-out commit");
		expect(request).not.toHaveBeenCalled();
	});
});
