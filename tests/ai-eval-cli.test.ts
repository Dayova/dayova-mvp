// @vitest-environment node
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";
import { expect, test } from "vitest";

const execute = promisify(execFile);
test("the CLI runs a bounded comparison through a mocked provider and emits a blinded review", {
	timeout: 70_000,
}, async () => {
	const directory = await mkdtemp(join(tmpdir(), "dayova-ai-eval-"));
	const stub = join(directory, "provider.mjs");
	await writeFile(
		stub,
		`
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
 if (String(url).startsWith('http://127.0.0.1:')) return originalFetch(url, options);
 if (!String(url).startsWith('https://api.openai.com/')) throw new Error('Unexpected network request');
 return new Response(JSON.stringify({ id:'resp_test', created_at:1, model:'test-model', object:'response', status:'completed',
 output:[{type:'message', id:'msg_test', status:'completed', role:'assistant', content:[{type:'output_text', text:JSON.stringify({rating:'correct',review:'Die Steigung 2 und der Funktionswert 11 stimmen.'}), annotations:[]}]}],
 usage:{input_tokens:100,input_tokens_details:{cached_tokens:20},output_tokens:40,output_tokens_details:{reasoning_tokens:10},total_tokens:140}
 }), {status:200,headers:{'content-type':'application/json'}});
};
`,
	);
	const config = join(directory, "models.json");
	await writeFile(
		config,
		JSON.stringify([
			{
				id: "mock",
				provider: "openai",
				model: "test-model",
				prices: { input: 1, cachedInput: 0.1, output: 2 },
				pricingSource: "https://example.com/test-only-pricing",
				pricingReviewedAt: "2026-10-18",
			},
		]),
	);
	const args = [
		"--import",
		pathToFileURL(stub).href,
		"--import",
		"tsx",
		"scripts/ai-eval.ts",
		"--live",
		"--config",
		config,
		"--models",
		"mock",
		"--operation",
		"answer_evaluation",
		"--limit",
		"1",
		"--repeat",
		"2",
		"--max-calls",
		"2",
		"--max-usd",
		"1",
		"--output",
		directory,
	];
	const env = {
		...process.env,
		OPENAI_API_KEY: "test-only",
		LANGFUSE_ENABLED: "false",
	};
	await execute(process.execPath, args, {
		cwd: resolve("."),
		env,
		timeout: 20_000,
	});
	const reportName = (await readdir(directory)).find(
		(name) =>
			name.endsWith(".json") &&
			!name.includes("summary") &&
			name !== "models.json",
	);
	if (!reportName) throw new Error("Report missing");
	const reportPath = join(directory, reportName);
	const report = JSON.parse(await readFile(reportPath, "utf8"));
	expect(report.results).toHaveLength(2);
	expect(
		report.results.every((row: { status: string }) => row.status === "success"),
	).toBe(true);
	expect(report.spent).toBeCloseTo(0.000324);
	expect(report.results[0].scores).toContainEqual({
		name: "grading_accuracy",
		value: 1,
	});
	await execute(
		process.execPath,
		["--import", "tsx", "scripts/ai-eval-review.ts", "--report", reportPath],
		{ env, timeout: 20_000 },
	);
	const review = JSON.parse(
		await readFile(`${reportPath}.review.json`, "utf8"),
	);
	expect(review.items).toHaveLength(2);
	expect(JSON.stringify(review)).not.toContain('"model"');
	const published: string[] = [];
	const server = createServer((request, response) => {
		const chunks: Buffer[] = [];
		request.on("data", (chunk) => chunks.push(chunk));
		request.on("end", () => {
			const bytes = Buffer.concat(chunks);
			published.push(
				(request.headers["content-encoding"] === "gzip"
					? gunzipSync(bytes)
					: bytes
				).toString("utf8"),
			);
			response.writeHead(200, { "content-type": "application/json" });
			response.end(JSON.stringify({ successes: [], errors: [] }));
		});
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string")
		throw new Error("Server unavailable");
	try {
		await execute(
			process.execPath,
			[
				...args.slice(0, -2),
				"--output",
				join(directory, "published"),
				"--publish",
			],
			{
				timeout: 20_000,
				env: {
					...env,
					LANGFUSE_TRACING_ENVIRONMENT: "evaluation",
					LANGFUSE_PUBLIC_KEY: "pk-test",
					LANGFUSE_SECRET_KEY: "sk-test",
					LANGFUSE_BASE_URL: `http://127.0.0.1:${address.port}`,
				},
			},
		);
		expect(published.join("")).toContain("langfuse.experiment.name");
		expect(published.join("")).toContain("grading_accuracy");
		expect(published.join("")).toContain("langfuse.observation.cost_details");
	} finally {
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		);
	}
	await expect(
		execute(
			process.execPath,
			[...args.slice(0, -2), "--output", directory, "--max-calls", "1"],
			{ env, timeout: 20_000 },
		),
	).rejects.toThrow();
});
