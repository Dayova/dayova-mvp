import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { platform } from "node:os";
import { createServer } from "vite";

const phase = process.argv[2] ?? "baseline";
const output = process.argv[3];
const prefixes = process.argv.includes("--prefixes");
const budgetArgument = process.argv.find((arg) => arg.startsWith("--max-ms="));
const budget = budgetArgument
	? Number(budgetArgument.split("=")[1])
	: undefined;
assert.ok(
	budget === undefined || (Number.isFinite(budget) && budget > 0),
	"--max-ms must be a positive number",
);
const vite = await createServer({
	server: { middlewareMode: true },
	appType: "custom",
});
const originalFetch = globalThis.fetch;
let requests = [];
globalThis.fetch = async (...args) => {
	const start = performance.now();
	const response = await originalFetch(...args);
	const bytes = await response.arrayBuffer();
	const url = new URL(String(args[0]));
	requests.push({
		page: Number(url.searchParams.get("skipCount") ?? 0),
		ms: Math.round(performance.now() - start),
		bytes: bytes.byteLength,
		status: response.status,
	});
	return new Response(bytes, {
		status: response.status,
		headers: response.headers,
	});
};
try {
	const { searchWloTopics } = await vite.ssrLoadModule("/convex/wloTopics.ts");
	const results = [];
	const cases = prefixes
		? [
				["Lin", "Mathematik"],
				["Bil", "Mathematik"],
				["Funk", "Mathematik"],
			]
		: [
				["Bilanz", "Rechnungswesen"],
				["Gedicht", "Deutsch"],
				["Vektor", "Mathe LK"],
				["Klima", "Erdkunde"],
				["Zelle", "Biologie"],
				["Demokr", "Sozialkunde"],
			];
	for (const [query, subject] of cases) {
		requests = [];
		const start = performance.now();
		try {
			const result = await searchWloTopics(query, subject);
			if (query === "Bilanz") assert.equal(result.topics[0]?.title, "Bilanz");
			const row = {
				query,
				subject,
				ms: Math.round(performance.now() - start),
				requests: [...requests],
				result,
			};
			results.push(row);
			console.log(
				JSON.stringify({
					...row,
					result: undefined,
					count: result.topics.length,
					truncated: result.truncated,
				}),
			);
		} catch (e) {
			results.push({
				query,
				subject,
				ms: Math.round(performance.now() - start),
				error: e.name,
				requests: [...requests],
			});
			console.log(JSON.stringify({ query, error: e.name }));
		}
	}
	const report = {
		phase,
		capturedAt: new Date().toISOString(),
		environment: `${platform()} direct provider adapter, synthetic inputs; excludes debounce, app rendering and Convex round trip`,
		results,
	};
	if (output) writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
	if (budget !== undefined) {
		assert.ok(
			results.every((row) => !row.error && row.ms <= budget),
			`Provider searches failed or exceeded ${budget} ms; inspect the saved report`,
		);
	}
} finally {
	globalThis.fetch = originalFetch;
	await vite.close();
}
