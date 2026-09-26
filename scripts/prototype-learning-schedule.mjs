// Throwaway browser harness. Does not load the Expo app, auth, or Convex.
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(
	new URL(
		"../src/features/learning-plans/schedule-prototype/",
		import.meta.url,
	),
);
const server = await createServer({
	configFile: false,
	root,
	esbuild: { jsx: "automatic" },
	server: { host: "127.0.0.1", port: 8766, strictPort: true },
});
await server.listen();
console.log(
	"Learning schedule experiment: http://127.0.0.1:8766/learning-plans/demo?variant=A",
);
