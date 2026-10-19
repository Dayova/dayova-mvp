import http from "node:http";
import { createServer } from "vite";

const vite = await createServer({
	server: { middlewareMode: true },
	appType: "custom",
});
const { searchWloTopics } = await vite.ssrLoadModule("/convex/wloTopics.ts");
http
	.createServer(async (req, res) => {
		const url = new URL(req.url, "http://localhost");
		res.setHeader("Content-Type", "application/json");
		try {
			const result = await searchWloTopics(
				url.searchParams.get("query") ?? "",
				url.searchParams.get("subject") ?? "Deutsch",
			);
			res.end(JSON.stringify(result));
		} catch {
			res.writeHead(502);
			res.end(JSON.stringify({ error: "Provider unavailable" }));
		}
	})
	.listen(8764, "127.0.0.1", () =>
		process.stdout.write("PR884 local provider adapter ready on 8764\n"),
	);
