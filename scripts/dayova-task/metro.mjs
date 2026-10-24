import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { portAvailable, TaskResources } from "./resources.mjs";

// Run in an owned terminal. Ctrl-C stops only the child group created here.
// A stale record blocks cleanup; it never authorizes killing a recycled PID.
const { values } = parseArgs({
	options: { id: { type: "string" }, owner: { type: "string" } },
});
const resources = new TaskResources(
	process.cwd(),
	values.owner ?? process.env.CODEX_THREAD_ID,
);
let child;
let claimed = false;
try {
	let environment;
	const state = await resources.port(values.id);
	const entry = realpathSync(join(state.root, "node_modules/expo/bin/cli"));
	await resources.taskLocked(state.id, () =>
		resources.locked(async () => {
			environment = resources.environment(values.id, process.env);
			const current = resources.read(state.id);
			if (!current.port || current.port !== state.port)
				throw new Error(
					"Metro port lease changed; retry allocation before launch",
				);
			if (current.metro)
				throw new Error("Metro already claimed; inspect its owned terminal");
			if (!(await portAvailable(current.port)))
				throw new Error("Claimed port is occupied; do not stop its listener");
			current.metro = {
				supervisorPid: process.pid,
				port: current.port,
				startedAt: new Date().toISOString(),
			};
			resources.save(current);
			claimed = true;
		}),
	);
	child = spawn(
		process.execPath,
		[
			entry,
			"start",
			"--dev-client",
			"--localhost",
			"--port",
			String(state.port),
		],
		{ cwd: state.root, env: environment, stdio: "inherit", detached: true },
	);
	let running = true;
	const stop = () => {
		if (running && child.pid) {
			try {
				process.kill(-child.pid, "SIGTERM");
			} catch (error) {
				if (error.code !== "ESRCH") throw error;
			}
		}
	};
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);
	console.log(
		`Owned Metro: ${state.root} on ${state.port}; stop this terminal with Ctrl-C.`,
	);
	process.exitCode = await new Promise((resolve, reject) => {
		child.once("error", (error) => {
			running = false;
			reject(error);
		});
		child.once("exit", (code, signal) => {
			running = false;
			resolve(signal === "SIGTERM" ? 0 : (code ?? 1));
		});
	});
	process.off("SIGINT", stop);
	process.off("SIGTERM", stop);
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
} finally {
	if (claimed)
		await resources.taskLocked(values.id, () =>
			resources.locked(() => {
				const state = resources.read(values.id);
				if (state.metro?.supervisorPid !== process.pid)
					throw new Error("Metro ownership changed; refusing cleanup");
				delete state.metro;
				resources.save(state);
			}),
		);
}
