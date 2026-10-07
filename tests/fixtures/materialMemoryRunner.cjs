const { createRequire } = require("node:module");
const { createReadStream } = require("node:fs");
const { Readable } = require("node:stream");
const { fork } = require("node:child_process");
const load = createRequire(`${process.cwd()}/package.json`);
const { generateText } = load("ai");
const { createVertex } = load("@ai-sdk/google-vertex");
const [bundle, fixture, count, bytes] = process.argv.slice(2);
const { __testOnlyLearningPlanAi } = load(bundle);

const nativeFetch = global.fetch;
(async () => {
	global.fetch = async () =>
		new Response(Readable.toWeb(createReadStream(fixture)));
	const ctx = {
		runMutation: async (_reference, args) =>
			"accessKey" in args
				? { status: "ok", downloadUrl: "https://example.invalid/fixture" }
				: { downloadToken: "fixture" },
	};
	const documents = Array.from({ length: Number(count) }, (_, i) => ({
		storageId: `file-${i}`,
		storageProvider: "convex",
		fileName: `worksheet-${i}.pdf`,
		fileType: "application/pdf",
		fileSizeBytes: Number(bytes),
	}));
	const { fileParts, sourceContext } =
		await __testOnlyLearningPlanAi.buildModelInputFromDocuments(
			ctx,
			documents,
			"test",
		);
	let requestBytes = 0;
	let activeRequests = 0;
	let peakActiveRequests = 0;
	let completedRequests = 0;
	// The receiving server is a separate process, like the actual provider.
	// Only the backend client process contributes to the measured RSS.
	const server = fork("tests/fixtures/materialHttpServer.cjs", {
		stdio: ["ignore", "ignore", "inherit", "ipc"],
	});
	const port = await new Promise((resolve, reject) => {
		server.once("message", resolve);
		server.once("error", reject);
	});
	global.fetch = nativeFetch;
	const model = createVertex({
		apiKey: "local-test",
		fetch: async (_url, init) => {
			requestBytes = Buffer.byteLength(init.body);
			activeRequests += 1;
			peakActiveRequests = Math.max(peakActiveRequests, activeRequests);
			try {
				const response = await __testOnlyLearningPlanAi.vertexFetch(
					`http://127.0.0.1:${port}`,
					init,
				);
				completedRequests += 1;
				return response;
			} finally {
				activeRequests -= 1;
			}
		},
	})("gemini-3-flash-preview");
	await __testOnlyLearningPlanAi.mapMaterialBatches(
		[1, 2, 3],
		fileParts,
		async () => {
			const result = await generateText({
				model,
				messages: [
					{
						role: "user",
						content: [
							{ type: "text", text: sourceContext || "Read the worksheets." },
							...fileParts,
						],
					},
				],
				maxOutputTokens: 512,
				maxRetries: 0,
			});
			// Production stores normalized content, not SDK request/response bodies.
			return result.text;
		},
	);
	server.disconnect();
	console.log(
		JSON.stringify({
			documents: fileParts.length,
			rawBytes: fileParts.reduce(
				(sum, part) => sum + Buffer.byteLength(part.data, "base64"),
				0,
			),
			requestBytes,
			peakActiveRequests,
			completedRequests,
			peakRssKiB: process.resourceUsage().maxRSS,
		}),
	);
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
