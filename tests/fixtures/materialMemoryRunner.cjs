const { createRequire } = require("node:module");
const { createReadStream } = require("node:fs");
const { Readable } = require("node:stream");
const load = createRequire(`${process.cwd()}/package.json`);
const { generateText } = load("ai");
const { createVertex } = load("@ai-sdk/google-vertex");
const [bundle, fixture, count, bytes] = process.argv.slice(2);
const { __testOnlyLearningPlanAi } = load(bundle);

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
	const model = createVertex({
		apiKey: "local-test",
		fetch: async (_url, init) => {
			requestBytes = Buffer.byteLength(init.body);
			return new Response(
				JSON.stringify({
					candidates: [
						{
							content: { role: "model", parts: [{ text: "fixture accepted" }] },
							finishReason: "STOP",
						},
					],
					usageMetadata: {
						promptTokenCount: 1,
						candidatesTokenCount: 1,
						totalTokenCount: 2,
					},
				}),
				{ headers: { "Content-Type": "application/json" } },
			);
		},
	})("gemini-3-flash-preview");
	await generateText({
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
	console.log(
		JSON.stringify({
			documents: fileParts.length,
			rawBytes: fileParts.reduce(
				(sum, part) => sum + Buffer.byteLength(part.data, "base64"),
				0,
			),
			requestBytes,
			peakRssKiB: process.resourceUsage().maxRSS,
		}),
	);
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
