/** Run from the repository root. Contacts the live public WLO catalog through the real adapter. */
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({
	server: { middlewareMode: true, hmr: false },
	appType: "custom",
});
try {
	const { searchWloTopics } = await server.ssrLoadModule(
		"/convex/wloTopics.ts",
	);
	for (const [query, subject, expected] of [
		["Gedichts", "Deutsch", "Gedichtanalyse"],
		["Gedicht", "Deutsch", "Gedichtanalyse"],
		["Gedichtsanalyse", "Deutsch", "Gedichtanalyse"],
		["Rhetor", "Deutsch", "Rhetorische Stilmittel"],
		["Vektor", "Mathe LK", "Vektoren"],
		["Zelle", "Biologie", null],
		["xyzqzvxx", "Deutsch", null],
	]) {
		const start = performance.now();
		const result = await searchWloTopics(query, subject);
		console.log(
			JSON.stringify({
				query,
				subject,
				...result,
				ms: Math.round(performance.now() - start),
			}),
		);
		if (expected)
			assert.ok(
				result.topics.some((topic) => topic.title === expected),
				`${query}: expected ${expected}`,
			);
		if (query === "Gedichts") {
			assert.ok(
				result.topics.length >= 2,
				"Gedichts: expected multiple suggestions",
			);
			assert.equal(result.topics[0].title, "Gedichtanalyse");
			assert.equal(result.topics[0].isAdditional, false);
		}
		if (query === "xyzqzvxx") assert.equal(result.topics.length, 0);
	}
} finally {
	await server.close();
}
