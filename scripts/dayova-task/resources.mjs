import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createConnection, createServer } from "node:net";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const native = (...args) => {
	const output = execFileSync("xcrun", ["simctl", ...args], {
		encoding: "utf8",
		timeout: 120_000,
	}).trim();
	return args.includes("--json") ? JSON.parse(output) : output;
};
const canonicalModel = (value) =>
	/^\d/.test(value) ? `iPhone ${value}` : value;

export async function portAvailable(port) {
	// macOS can permit a specific-address bind beside a wildcard listener.
	// Probe existing listeners as well as testing both wildcard binds.
	for (const host of ["127.0.0.1", "::1"]) {
		const listening = await new Promise((resolveResult) => {
			const socket = createConnection({ port, host });
			const done = (value) => {
				socket.destroy();
				resolveResult(value);
			};
			socket.once("connect", () => done(true));
			socket.once("error", (error) => done(error.code !== "ECONNREFUSED"));
			socket.setTimeout(500, () => done(true));
		});
		if (listening) return false;
	}
	for (const host of ["0.0.0.0", "::"]) {
		const server = createServer();
		const available = await new Promise((resolveResult) => {
			server.once("error", () => resolveResult(false));
			server.listen(port, host, () => server.close(() => resolveResult(true)));
		});
		if (!available) return false;
	}
	return true;
}

// Registry is shared by Git worktrees, but never tracked. Native commands are
// the only injectable boundary; ownership, persistence and sockets are real.
export class TaskResources {
	constructor(root, owner, simctl = native) {
		if (!owner) throw new Error("Supply --owner with the current chat ID");
		this.root = realpathSync(root);
		this.owner = owner;
		this.simctl = simctl;
		this.registry = join(
			this.git("rev-parse", "--path-format=absolute", "--git-common-dir"),
			"dayova-tasks",
		);
	}

	git(...args) {
		return execFileSync("git", args, {
			cwd: this.root,
			encoding: "utf8",
		}).trim();
	}

	probe() {
		// Real create/write/delete, including a worktree's private Git directory.
		for (const directory of [
			this.git("rev-parse", "--absolute-git-dir"),
			resolve(this.registry, ".."),
			join(this.root, ".agents"),
		]) {
			const file = join(directory, `.dayova-access-${randomUUID()}`);
			writeFileSync(file, "access probe", { flag: "wx", mode: 0o600 });
			rmSync(file);
		}
	}

	async locked(fn, name = "lock") {
		mkdirSync(this.registry, { recursive: true, mode: 0o700 });
		const lock = join(this.registry, name);
		for (let attempt = 0; ; attempt++) {
			try {
				mkdirSync(lock);
				break;
			} catch (error) {
				if (error.code !== "EEXIST" || attempt >= 100)
					throw new Error(
						`Resource registry busy; do not remove another task's lock (${error.code})`,
					);
				await delay(50);
			}
		}
		try {
			return await fn();
		} finally {
			rmSync(lock, { recursive: true });
		}
	}

	async taskLocked(id, fn) {
		this.file(id);
		return this.locked(fn, `task-${id}.lock`);
	}

	file(id) {
		if (!/^[a-f0-9-]{36}$/.test(id))
			throw new Error("Invalid task resource ID");
		return join(this.registry, `${id}.json`);
	}

	all() {
		return readdirSync(this.registry)
			.filter((name) => name.endsWith(".json"))
			.map((name) =>
				JSON.parse(readFileSync(join(this.registry, name), "utf8")),
			);
	}

	save(state) {
		const file = this.file(state.id);
		writeFileSync(`${file}.tmp`, `${JSON.stringify(state, null, 2)}\n`, {
			mode: 0o600,
		});
		renameSync(`${file}.tmp`, file);
		return state;
	}

	read(id) {
		const state = JSON.parse(readFileSync(this.file(id), "utf8"));
		if (state.owner !== this.owner || state.root !== this.root)
			throw new Error("Resource owner/worktree mismatch");
		if (state.branch !== this.git("branch", "--show-current"))
			throw new Error("Task branch changed; refusing resource mutation");
		if (state.closed)
			throw new Error("Task resources are closed; initialize a new session");
		return state;
	}

	async init({ base, task }) {
		this.probe();
		if (!base || !task)
			throw new Error("Explicit reviewed base and task are required");
		const branch = this.git("branch", "--show-current");
		if (!branch.startsWith("codex/"))
			throw new Error(
				"Initialize only a newly created task-owned codex/ branch",
			);
		const baseSha = this.git("rev-parse", "--verify", `${base}^{commit}`);
		return this.locked(() => {
			const existing = this.all().find(
				(s) => !s.closed && (s.root === this.root || s.branch === branch),
			);
			if (existing) {
				if (
					existing.owner !== this.owner ||
					existing.task !== task ||
					existing.root !== this.root ||
					existing.base !== base
				)
					throw new Error("Worktree/branch already claimed by a task");
				return this.read(existing.id);
			}
			// Existing branch adoption needs provenance, not a name that looks safe.
			if (this.git("rev-parse", "HEAD") !== baseSha)
				throw new Error(
					"First claim must be at the reviewed base before implementation; do not adopt an unowned branch",
				);
			return this.save({
				id: randomUUID(),
				owner: this.owner,
				root: this.root,
				branch,
				base,
				baseSha,
				task,
				createdAt: new Date().toISOString(),
			});
		});
	}

	async simulator(id, preferences = {}) {
		return this.taskLocked(id, async () => {
			const state = this.read(id);
			const model =
				preferences.model ?? state.simulator?.model ?? "iPhone 17 Pro";
			const os = preferences.os ?? state.simulator?.os;
			const appearance =
				preferences.appearance ?? state.simulator?.appearance ?? "light";
			if (!["dark", "light"].includes(appearance))
				throw new Error("appearance must be dark or light");
			const type = this.simctl(
				"list",
				"devicetypes",
				"--json",
			).devicetypes.find(
				(d) => d.name.toLowerCase() === canonicalModel(model).toLowerCase(),
			);
			if (!type)
				throw new Error(`Requested simulator model unavailable: ${model}`);
			const compatible = this.simctl(
				"list",
				"runtimes",
				"--json",
			).runtimes.filter(
				(r) =>
					r.isAvailable &&
					r.name.startsWith("iOS ") &&
					r.supportedDeviceTypes?.some((d) => d.identifier === type.identifier),
			);
			const runtime = compatible
				.filter(
					(r) =>
						!os || r.version === os || r.name === os || r.identifier === os,
				)
				.sort((a, b) =>
					b.version.localeCompare(a.version, undefined, { numeric: true }),
				)[0];
			if (!runtime)
				throw new Error(
					`Requested compatible iOS runtime unavailable: ${os ?? "installed"}`,
				);
			if (state.simulator) {
				const saved = state.simulator;
				if (
					saved.type !== type.identifier ||
					saved.runtime !== runtime.identifier ||
					saved.appearance !== appearance
				)
					throw new Error(
						"Resume preferences differ; clean up owned runtime resources first",
					);
				this.boot(state);
				return state;
			}
			const name = `dayova-task-${state.id}`;
			const udid = this.simctl(
				"create",
				name,
				type.identifier,
				runtime.identifier,
			);
			state.simulator = {
				name,
				udid,
				type: type.identifier,
				model: type.name,
				runtime: runtime.identifier,
				os: runtime.version,
				appearance,
			};
			await this.locked(() => this.save(state)); // Persist before boot for recovery.
			// Native operations hold only the task lock, never the shared registry.
			this.boot(state);
			return state;
		});
	}

	ownedDevice(state) {
		const saved = state.simulator;
		const devices =
			this.simctl("list", "devices", "--json").devices[saved.runtime] ?? [];
		const device = devices.find((d) => d.udid === saved.udid);
		if (
			!device ||
			device.name !== saved.name ||
			device.deviceTypeIdentifier !== saved.type
		)
			throw new Error(
				"Simulator ownership no longer matches; refusing mutation",
			);
		return device;
	}

	boot(state) {
		const device = this.ownedDevice(state);
		if (device.state !== "Booted") this.simctl("boot", device.udid);
		this.simctl("bootstatus", device.udid, "-b");
		this.simctl("ui", device.udid, "appearance", state.simulator.appearance);
	}

	async port(id, start = 8082) {
		if (!Number.isInteger(start) || start < 1024 || start > 65535)
			throw new Error("Invalid port range");
		return this.taskLocked(id, () =>
			this.locked(async () => {
				const state = this.read(id);
				if (state.port) return state;
				const claimed = new Set(
					this.all()
						.filter((s) => !s.closed)
						.map((s) => s.port),
				);
				for (let port = start; port < Math.min(start + 100, 65536); port++) {
					if (!claimed.has(port) && (await portAvailable(port))) {
						state.port = port;
						return this.save(state);
					}
				}
				throw new Error(
					"No unclaimed available Metro port; do not stop another server",
				);
			}),
		);
	}

	async backend(id, proof) {
		return this.taskLocked(id, () =>
			this.locked(() => {
				const state = this.read(id);
				if (!["dev", "preview", "local"].includes(proof.type))
					throw new Error("A verified non-production deployment is required");
				for (const field of ["url", "siteUrl", "clerkIssuer", "source"])
					if (typeof proof[field] !== "string" || !proof[field].trim())
						throw new Error(`Missing provider evidence: ${field}`);
				if (!["shared-read-only", "task-owned"].includes(proof.isolation))
					throw new Error("Declare backend isolation explicitly");
				if (
					proof.isolation === "task-owned" &&
					(!proof.accountRef || !proof.fixtureScope)
				)
					throw new Error(
						"Task-owned backend use needs a synthetic account reference and fixture scope",
					);
				if (state.metro)
					throw new Error(
						"Stop owned Metro before changing backend configuration",
					);
				if (
					proof.isolation === "task-owned" &&
					this.all().some(
						(other) =>
							other.id !== id &&
							!other.closed &&
							other.backend?.url === proof.url &&
							other.backend?.accountRef === proof.accountRef,
					)
				) {
					throw new Error("Synthetic account already claimed by another task");
				}
				// This records the agent's provider inspection, not independent cloud proof.
				state.backend = {
					type: proof.type,
					url: proof.url,
					siteUrl: proof.siteUrl,
					clerkIssuer: proof.clerkIssuer,
					source: proof.source,
					isolation: proof.isolation,
					accountRef: proof.accountRef,
					fixtureScope: proof.fixtureScope,
					verifiedAt: new Date().toISOString(),
				};
				return this.save(state);
			}),
		);
	}

	environment(id, env) {
		const state = this.read(id);
		const proof = state.backend;
		if (!proof)
			throw new Error(
				"Verify backend inventory, issuer and isolation before Metro",
			);
		if (
			env.EXPO_PUBLIC_CONVEX_URL !== proof.url ||
			env.EXPO_PUBLIC_CONVEX_SITE_URL !== proof.siteUrl
		)
			throw new Error(
				"Public backend endpoints must match verified provider evidence",
			);
		const key = env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
		const issuer = key?.startsWith("pk_test_")
			? `https://${Buffer.from(key.slice(8), "base64").toString().replace(/\$$/, "")}`
			: "";
		if (issuer !== proof.clerkIssuer)
			throw new Error(
				"Clerk test issuer must match verified backend authentication config",
			);
		const result = {};
		for (const [key, value] of Object.entries(env)) {
			if (
				["PATH", "HOME", "TMPDIR", "LANG", "DEVELOPER_DIR"].includes(key) ||
				key.startsWith("EXPO_PUBLIC_")
			)
				result[key] = value;
		}
		for (const key of Object.keys(result))
			if (/POSTHOG|LANGFUSE/.test(key)) delete result[key];
		return {
			...result,
			EXPO_NO_DOTENV: "1",
			APP_VARIANT: "development",
			CI: "1",
		};
	}

	async cleanup(id) {
		return this.taskLocked(id, async () => {
			const state = this.read(id);
			if (state.metro)
				throw new Error(
					"Stop the owned Metro terminal/supervisor first; never kill by port or process name",
				);
			if (state.simulator) {
				const device = this.ownedDevice(state);
				if (device.state !== "Shutdown") this.simctl("shutdown", device.udid);
				this.simctl("delete", device.udid);
				delete state.simulator;
			}
			delete state.port;
			state.runtimeCleanedAt = new Date().toISOString();
			return this.locked(() => this.save(state));
		});
	}
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	try {
		const { values, positionals } = parseArgs({
			allowPositionals: true,
			options: Object.fromEntries(
				[
					"root",
					"owner",
					"id",
					"base",
					"task",
					"model",
					"os",
					"appearance",
					"proof",
				].map((k) => [k, { type: "string" }]),
			),
		});
		const resources = new TaskResources(
			values.root ?? process.cwd(),
			values.owner ?? process.env.CODEX_THREAD_ID,
		);
		const [command] = positionals;
		let result;
		if (command === "probe") {
			resources.probe();
			result = { access: "passed" };
		} else if (command === "init") result = await resources.init(values);
		else if (command === "status") result = resources.read(values.id);
		else if (command === "simulator")
			result = await resources.simulator(values.id, values);
		else if (command === "port") result = await resources.port(values.id);
		else if (command === "backend")
			result = await resources.backend(
				values.id,
				JSON.parse(readFileSync(values.proof, "utf8")),
			);
		else if (command === "cleanup") result = await resources.cleanup(values.id);
		else
			throw new Error(
				"Commands: probe, init --base REF --task TEXT, status/simulator/port/backend/cleanup --id UUID",
			);
		console.log(JSON.stringify(result, null, 2));
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
