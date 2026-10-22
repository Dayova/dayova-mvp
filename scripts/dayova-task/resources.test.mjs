import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskResources } from "./resources.mjs";

// Public resource workflow, real Git/files/ports; only simctl is a native boundary.
// A reused named device, owner-blind resume, or unleased port must fail these cases.
function fixture(t) {
	const root = mkdtempSync(join(tmpdir(), "dayova-task-test-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const git = (...args) =>
		execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
	git("init", "-b", "main");
	mkdirSync(join(root, ".agents"));
	writeFileSync(join(root, ".agents/fixture"), "test");
	git("add", ".agents");
	git(
		"-c",
		"user.name=Test",
		"-c",
		"user.email=test@example.invalid",
		"commit",
		"--allow-empty",
		"-m",
		"base",
	);
	git("switch", "-c", "codex/test");
	const devices = [
		{
			udid: "foreign",
			name: "iPhone 17 Pro",
			deviceTypeIdentifier: "pro",
			state: "Booted",
		},
	];
	const calls = [];
	const native = (...args) => {
		calls.push(args);
		if (args[0] === "list" && args[1] === "devicetypes")
			return {
				devicetypes: [
					{ name: "iPhone 17 Pro", identifier: "pro" },
					{ name: "iPhone 17 Pro Max", identifier: "max" },
				],
			};
		if (args[0] === "list" && args[1] === "runtimes")
			return {
				runtimes: [
					{
						identifier: "ios27",
						name: "iOS 27.0",
						version: "27.0",
						isAvailable: true,
						supportedDeviceTypes: [
							{ identifier: "pro" },
							{ identifier: "max" },
						],
					},
				],
			};
		if (args[0] === "list") return { devices: { ios27: devices } };
		if (args[0] === "create") {
			const udid = `new-${devices.length}`;
			devices.push({
				udid,
				name: args[1],
				deviceTypeIdentifier: args[2],
				state: "Shutdown",
			});
			return udid;
		}
		const device = devices.find((d) => d.udid === args[1]);
		assert.ok(device, "native mutations must target an existing explicit UDID");
		if (args[0] === "boot") device.state = "Booted";
		if (args[0] === "shutdown") device.state = "Shutdown";
		if (args[0] === "delete") devices.splice(devices.indexOf(device), 1);
		return "";
	};
	return {
		root,
		git,
		devices,
		calls,
		native,
		resources: new TaskResources(root, "chat-a", native),
	};
}

test("17 Pro creates a fresh exact model, applies dark mode, resumes only its owner", async (t) => {
	const f = fixture(t);
	const task = await f.resources.init({ base: "main", task: "DAY-123" });
	const state = await f.resources.simulator(task.id, {
		model: "17 Pro",
		os: "27.0",
		appearance: "dark",
	});
	assert.equal(state.simulator.model, "iPhone 17 Pro");
	assert.notEqual(state.simulator.udid, "foreign");
	assert.equal(
		(await f.resources.simulator(task.id)).simulator.appearance,
		"dark",
	);
	assert.ok(
		f.calls.some(
			(c) => c.join(" ") === `ui ${state.simulator.udid} appearance dark`,
		),
	);
	assert.equal(
		(
			await f.resources.simulator(task.id, {
				model: "iPhone 17 Pro",
				os: "27.0",
				appearance: "dark",
			})
		).simulator.udid,
		state.simulator.udid,
	);
	await assert.rejects(
		new TaskResources(f.root, "chat-b", f.native).cleanup(task.id),
		/owner/,
	);
	await assert.rejects(
		f.resources.simulator(task.id, {
			model: "17 Pro Max",
			os: "27.0",
			appearance: "dark",
		}),
		/preferences/,
	);
	await f.resources.cleanup(task.id);
	assert.deepEqual(f.devices, [
		{
			udid: "foreign",
			name: "iPhone 17 Pro",
			deviceTypeIdentifier: "pro",
			state: "Booted",
		},
	]);
});

test("unavailable model or OS fails without allocating or touching a device", async (t) => {
	const f = fixture(t);
	const task = await f.resources.init({
		base: "main",
		task: "description only",
	});
	await assert.rejects(
		f.resources.simulator(task.id, { model: "17", os: "27.0" }),
		/model/,
	);
	await assert.rejects(
		f.resources.simulator(task.id, { model: "17 Pro", os: "99" }),
		/runtime/,
	);
	assert.equal(f.devices.length, 1);
});

test("concurrent task port claims differ and skip an unrelated listening service", async (t) => {
	const f = fixture(t);
	const server = createServer();
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	t.after(() => server.close());
	const port = server.address().port;
	const a = await f.resources.init({ base: "main", task: "A" });
	// Another task cannot claim the same worktree. Use a real second worktree.
	const second = join(f.root, "second");
	f.git("worktree", "add", "-b", "codex/second", second, "main");
	const other = new TaskResources(second, "chat-b", f.native);
	const b = await other.init({ base: "main", task: "B" });
	const [pa, pb] = await Promise.all([
		f.resources.port(a.id, port),
		other.port(b.id, port),
	]);
	assert.notEqual(pa.port, port);
	assert.notEqual(pb.port, port);
	assert.notEqual(pa.port, pb.port);
	await f.resources.cleanup(a.id);
	assert.equal(other.read(b.id).port, pb.port);
	assert.equal(server.listening, true);
	await other.cleanup(b.id);
});

test("worktree and branch ownership are checked before resource mutation", async (t) => {
	const f = fixture(t);
	const task = await f.resources.init({ base: "main", task: "A" });
	await assert.rejects(
		new TaskResources(f.root, "chat-b", f.native).init({
			base: "main",
			task: "B",
		}),
		/claimed/,
	);
	f.git("switch", "main");
	await assert.rejects(
		f.resources.simulator(task.id, { model: "17 Pro" }),
		/branch/,
	);
	assert.equal(f.devices.length, 1);
});

test("Metro environment gate rejects missing proof, production and endpoint/issuer drift", async (t) => {
	const f = fixture(t);
	const task = await f.resources.init({ base: "main", task: "A" });
	assert.throws(() => f.resources.environment(task.id, {}), /backend/);
	await assert.rejects(
		f.resources.backend(task.id, { type: "prod" }),
		/non-production/,
	);
	const proof = {
		type: "dev",
		url: "https://test.convex.cloud",
		siteUrl: "https://test.convex.site",
		clerkIssuer: "https://test.clerk.accounts.dev",
		source: "provider deployment inventory and auth config",
		isolation: "shared-read-only",
	};
	await f.resources.backend(task.id, proof);
	const env = {
		EXPO_PUBLIC_CONVEX_URL: proof.url,
		EXPO_PUBLIC_CONVEX_SITE_URL: proof.siteUrl,
		EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from("test.clerk.accounts.dev$").toString("base64")}`,
	};
	assert.equal(f.resources.environment(task.id, env).EXPO_NO_DOTENV, "1");
	assert.throws(
		() =>
			f.resources.environment(task.id, {
				...env,
				EXPO_PUBLIC_CONVEX_URL: "https://production.convex.cloud",
			}),
		/match/,
	);
	assert.throws(
		() =>
			f.resources.environment(task.id, {
				...env,
				EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_bad",
			}),
		/Clerk/,
	);
});

// Failure behavior at the native boundary: failed boot remains recoverable and
// a renamed device is never deleted based on a stale UUID alone.
test("partial native boot can resume; identity drift blocks cleanup", async (t) => {
	const f = fixture(t);
	let failBoot = true;
	const resources = new TaskResources(f.root, "chat-a", (...args) => {
		if (args[0] === "boot" && failBoot) throw new Error("native boot failed");
		return f.native(...args);
	});
	const task = await resources.init({ base: "main", task: "A" });
	await assert.rejects(
		resources.simulator(task.id, { model: "17 Pro" }),
		/native boot failed/,
	);
	const saved = resources.read(task.id).simulator;
	assert.ok(saved.udid);
	failBoot = false;
	await resources.simulator(task.id, { model: "17 Pro" });
	const device = f.devices.find((d) => d.udid === saved.udid);
	assert.equal(device.state, "Booted");
	device.name = "manually-reassigned";
	await assert.rejects(resources.cleanup(task.id), /ownership/);
	assert.equal(f.devices.length, 2);
	device.name = saved.name;
	await resources.cleanup(task.id);
	assert.equal(resources.read(task.id).simulator, undefined);
	const resumed = await resources.simulator(task.id, {
		model: "17 Pro",
		appearance: "dark",
	});
	assert.equal(resumed.simulator.appearance, "dark");
	await resources.cleanup(task.id);
});

test("failed access probe does not allocate a ledger or bypass the workspace", async (t) => {
	const f = fixture(t);
	rmSync(join(f.root, ".agents"), { recursive: true });
	await assert.rejects(f.resources.init({ base: "main", task: "A" }), /ENOENT/);
	assert.equal(f.devices.length, 1);
	assert.throws(() => f.resources.all(), /ENOENT/);
});

test("task-owned synthetic identity cannot be claimed by a second task", async (t) => {
	const f = fixture(t);
	const a = await f.resources.init({ base: "main", task: "A" });
	const second = join(f.root, "second");
	f.git("worktree", "add", "-b", "codex/second", second, "main");
	const other = new TaskResources(second, "chat-b", f.native);
	const b = await other.init({ base: "main", task: "B" });
	const proof = {
		type: "dev",
		url: "https://test.convex.cloud",
		siteUrl: "https://test.convex.site",
		clerkIssuer: "https://test.clerk.accounts.dev",
		source: "fixture provider inspection",
		isolation: "task-owned",
		accountRef: "synthetic-a",
		fixtureScope: "calendar-a",
	};
	await f.resources.backend(a.id, proof);
	await assert.rejects(other.backend(b.id, proof), /already claimed/);
	assert.equal(other.read(b.id).backend, undefined);
});

// The external Expo executable is substituted with a small HTTP server. This
// proves the real supervisor's env/port/signal handling, not Expo bundling.
test("two real supervisor processes isolate ports, environment and cleanup", async (t) => {
	const { spawn } = await import("node:child_process");
	const { once } = await import("node:events");
	const { setTimeout: delay } = await import("node:timers/promises");
	const script = new URL("./metro.mjs", import.meta.url).pathname;
	const f = fixture(t);
	const a = await f.resources.init({ base: "main", task: "A" });
	const second = join(f.root, "second");
	f.git("worktree", "add", "-b", "codex/second", second, "main");
	const other = new TaskResources(second, "chat-b", f.native);
	const b = await other.init({ base: "main", task: "B" });
	const proof = {
		type: "dev",
		url: "https://test.convex.cloud",
		siteUrl: "https://test.convex.site",
		clerkIssuer: "https://test.clerk.accounts.dev",
		source: "external provider fixture",
		isolation: "shared-read-only",
	};
	const processes = [];
	t.after(async () => {
		for (const p of processes)
			if (p.child.exitCode === null && p.child.signalCode === null) {
				p.child.kill("SIGTERM");
				await p.exit;
			}
	});
	const start = async (resources, task, owner) => {
		await resources.backend(task.id, proof);
		const state = await resources.port(task.id);
		const bin = join(resources.root, "node_modules/expo/bin");
		mkdirSync(bin, { recursive: true });
		writeFileSync(
			join(bin, "cli"),
			`const http = require('node:http');
      const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
      http.createServer((req, res) => res.end(JSON.stringify({cwd:process.cwd(), port, dotenv:process.env.EXPO_NO_DOTENV, variant:process.env.APP_VARIANT, secret:process.env.CONVEX_DEPLOY_KEY, analytics:process.env.EXPO_PUBLIC_POSTHOG_API_KEY}))).listen(port, '127.0.0.1');`,
		);
		const child = spawn(
			process.execPath,
			[script, "--id", task.id, "--owner", owner],
			{
				cwd: resources.root,
				env: {
					...process.env,
					EXPO_PUBLIC_CONVEX_URL: proof.url,
					EXPO_PUBLIC_CONVEX_SITE_URL: proof.siteUrl,
					EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from("test.clerk.accounts.dev$").toString("base64")}`,
					CONVEX_DEPLOY_KEY: "must-not-reach-child",
					EXPO_PUBLIC_POSTHOG_API_KEY: "must-not-reach-child",
				},
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		let output = "";
		child.stdout.on("data", (d) => {
			output += d;
		});
		child.stderr.on("data", (d) => {
			output += d;
		});
		const exit = once(child, "exit");
		processes.push({ child, exit });
		for (let attempts = 0; attempts < 200; attempts++) {
			if (child.exitCode !== null) assert.fail(output);
			try {
				const body = await (
					await fetch(`http://127.0.0.1:${state.port}`)
				).json();
				return { child, exit, state, body };
			} catch {
				await delay(25);
			}
		}
		assert.fail(`supervisor readiness timed out: ${output}`);
	};
	const first = await start(f.resources, a, "chat-a");
	const next = await start(other, b, "chat-b");
	assert.notEqual(first.state.port, next.state.port);
	assert.equal(first.body.cwd, f.resources.root);
	assert.equal(next.body.cwd, other.root);
	assert.equal(first.body.dotenv, "1");
	assert.equal(first.body.variant, "development");
	assert.equal(first.body.secret, undefined);
	assert.equal(first.body.analytics, undefined);
	await assert.rejects(f.resources.cleanup(a.id), /Metro/);
	first.child.kill("SIGTERM");
	assert.equal((await first.exit)[0], 0);
	await f.resources.cleanup(a.id);
	const stillRunning = await (
		await fetch(`http://127.0.0.1:${next.state.port}`)
	).json();
	assert.equal(stillRunning.cwd, other.root);
	next.child.kill("SIGTERM");
	assert.equal((await next.exit)[0], 0);
	await other.cleanup(b.id);
});

// Hold a native operation in a separate process: the app-facing allocation in
// another worktree must finish while that device remains blocked in bootstatus.
for (const slowCommand of ["create", "bootstatus", "shutdown"])
	test(`slow native ${slowCommand} does not block another task port allocation`, async (t) => {
		const { spawn } = await import("node:child_process");
		const { once } = await import("node:events");
		const { existsSync } = await import("node:fs");
		const { setTimeout: delay } = await import("node:timers/promises");
		const f = fixture(t);
		const a = await f.resources.init({ base: "main", task: "A" });
		const second = join(f.root, "second");
		f.git("worktree", "add", "-b", "codex/second", second, "main");
		const other = new TaskResources(second, "chat-b", f.native);
		const b = await other.init({ base: "main", task: "B" });
		const marker = join(f.root, "boot-entered");
		const release = join(f.root, "boot-release");
		const moduleUrl = new URL("./resources.mjs", import.meta.url).href;
		const code = `import {TaskResources} from ${JSON.stringify(moduleUrl)};
    import {writeFileSync, existsSync} from 'node:fs';
    let device;
    const native = (...args) => {
      if(args[0] === ${JSON.stringify(slowCommand)}) {
        writeFileSync(${JSON.stringify(marker)}, 'waiting');
        const wait = new Int32Array(new SharedArrayBuffer(4));
        const deadline = Date.now()+15000;
        while(!existsSync(${JSON.stringify(release)})) {if(Date.now()>deadline) throw new Error('release timeout'); Atomics.wait(wait,0,0,20);}
      }
      if(args[0] === 'list' && args[1] === 'devicetypes') return {devicetypes:[{name:'iPhone 17 Pro',identifier:'pro'}]};
      if(args[0] === 'list' && args[1] === 'runtimes') return {runtimes:[{name:'iOS 26.5',version:'26.5',identifier:'ios',isAvailable:true,supportedDeviceTypes:[{identifier:'pro'}]}]};
      if(args[0] === 'list') return {devices:{ios:[device]}};
      if(args[0] === 'create') {device={udid:'owned',name:args[1],deviceTypeIdentifier:'pro',state:'Booted'}; return 'owned';}
      return '';
    };
    const resources = new TaskResources(${JSON.stringify(f.root)},'chat-a',native);
    await resources.simulator(${JSON.stringify(a.id)});
    if (${JSON.stringify(slowCommand)} === 'shutdown') await resources.cleanup(${JSON.stringify(a.id)});`;
		const child = spawn(process.execPath, ["--input-type=module", "-e", code], {
			stdio: ["ignore", "ignore", "pipe"],
		});
		let stderr = "";
		child.stderr.on("data", (data) => {
			stderr += data;
		});
		const exit = once(child, "exit");
		t.after(async () => {
			if (child.exitCode === null && child.signalCode === null) {
				child.kill();
				await exit;
			}
		});
		for (let i = 0; i < 200 && !existsSync(marker); i++) await delay(25);
		assert.equal(
			existsSync(marker),
			true,
			stderr || "native boot must be active",
		);
		const allocated = await other.port(b.id);
		assert.ok(allocated.port > 0);
		assert.equal(
			child.exitCode,
			null,
			"allocation must complete before native boot is released",
		);
		writeFileSync(release, "release");
		assert.equal((await exit)[0], 0, stderr);
	});
