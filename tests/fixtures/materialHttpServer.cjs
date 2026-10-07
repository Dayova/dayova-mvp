const { createServer } = require("node:http");
const server = createServer(async (request, response) => {
	for await (const _chunk of request) {
		/* Drain without retaining uploaded bytes. */
	}
	await new Promise((resolve) => setTimeout(resolve, 100));
	response.setHeader("Content-Type", "application/json");
	response.end(
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
	);
});
server.listen(0, "127.0.0.1", () => process.send(server.address().port));
process.on("disconnect", () => {
	server.close();
	server.closeAllConnections();
});
