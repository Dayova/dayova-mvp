import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
	closeSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	openSync,
	statSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { CONTACT_CONSENT_VERSION } from "../../src/lib/contact-preferences.ts";
import { runDeviceSmoke } from "../ci-run-maestro.mjs";

const localUrl = "http://127.0.0.1:3210";
const metroUrl = "http://127.0.0.1:8094";
const issuer = "https://warm-parrot-13.clerk.accounts.dev";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Public entry point: refuse unsafe targets before starting native processes or
// making any request. Every database mutation below goes only to loopback.
export async function runContactPreferencesQa(
	appPath,
	{ env = process.env, scenario = "settings" } = {},
) {
	if (!["settings", "registration"].includes(scenario))
		throw new Error("Contact QA requires a known QA scenario");
	const host = env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
		? Buffer.from(env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY.slice(8), "base64")
				.toString()
				.replace(/\$$/, "")
		: "";
	if (
		!appPath ||
		host !== "warm-parrot-13.clerk.accounts.dev" ||
		!env.MAESTRO_CI_EMAIL?.includes("+clerk_test@") ||
		!env.MAESTRO_CI_PASSWORD ||
		!["com.dayova.dev", "de.dayova.app-dev"].includes(env.MAESTRO_APP_ID) ||
		env.EXPO_PUBLIC_CONVEX_URL !== localUrl ||
		Object.keys(env).some((key) => key.startsWith("CONVEX_") && env[key]) ||
		existsSync(".env.local") ||
		existsSync(".env")
	) {
		throw new Error(
			"Contact QA requires a fresh checkout, isolated test app/Clerk identity and loopback backend",
		);
	}
	const platform = env.MAESTRO_APP_ID === "com.dayova.dev" ? "android" : "ios";
	const sourceSha = spawnSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf8",
	}).stdout?.trim();
	assert.match(
		sourceSha ?? "",
		/^[a-f0-9]{40}$/,
		"QA source revision must be known",
	);
	const root = ".maestro/artifacts/contact-qa";
	const privateRoot = join(root, "private");
	const publicRoot = join(root, "public");
	mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
	mkdirSync(publicRoot, { recursive: true });
	const children = [];
	const results = [];
	let appInstalled = false;
	let authorization;
	let sessionId;
	let failure;
	let registrationAttempted = false;
	const childEnv = {
		...env,
		APP_VARIANT: "development",
		EAS_BUILD: "false",
		NODE_ENV: "development",
		// Keep Metro's localhost listener reachable at the explicit IPv4 URL on macOS.
		NODE_OPTIONS: "--dns-result-order=ipv4first",
		CONVEX_AGENT_MODE: "anonymous",
		EXPO_NO_DOTENV: "1",
		EXPO_PUBLIC_CONVEX_URL: localUrl,
		EXPO_PUBLIC_CONVEX_SITE_URL: "http://127.0.0.1:3211",
		EXPO_PUBLIC_POSTHOG_API_KEY: "",
		MAESTRO_DEV_SERVER_URL: metroUrl,
	};
	if (scenario === "registration") {
		childEnv.MAESTRO_CI_EMAIL = `day550-${randomBytes(10).toString("hex")}+clerk_test@example.com`;
		childEnv.MAESTRO_CI_PASSWORD = `${randomBytes(24).toString("base64url")}!aA1`;
	}
	delete childEnv.CONVEX_DEPLOY_KEY;
	delete childEnv.CONVEX_DEPLOYMENT;
	delete childEnv.DAYOVA_CI_VALIDATION;
	delete childEnv.DAYOVA_INTERNAL_VALIDATION;
	for (const key of Object.keys(childEnv)) {
		if (key.startsWith("NOTION_") || key === "CLERK_SECRET_KEY")
			delete childEnv[key];
	}
	const execute = (command, args, name) => {
		const fd = openSync(join(privateRoot, `${name}.log`), "w", 0o600);
		try {
			const result = spawnSync(command, args, {
				env: childEnv,
				stdio: ["ignore", fd, fd],
				timeout: 120_000,
			});
			if (result.status !== 0)
				throw new Error(`${name} failed; private diagnostics retained`);
		} finally {
			closeSync(fd);
		}
	};
	const start = (args, name) => {
		const fd = openSync(join(privateRoot, `${name}.log`), "w", 0o600);
		const child = spawn("pnpm", ["exec", ...args], {
			env: childEnv,
			stdio: ["ignore", fd, fd],
			detached: true,
		});
		closeSync(fd);
		children.push(child);
	};
	const waitFor = async (predicate, name, timeout = 120_000) => {
		const deadline = Date.now() + timeout;
		while (Date.now() < deadline) {
			try {
				if (await predicate()) return;
			} catch {
				/* Startup can precede function deployment. */
			}
			await sleep(500);
		}
		throw new Error(`${name} did not become ready`);
	};
	const clerk = async (
		path,
		form = {},
		{ method = "POST", sessionScoped = false } = {},
	) => {
		const url = new URL(`${issuer}/v1/${path}`);
		url.searchParams.set("_is_native", "true");
		if (sessionScoped) {
			assert.ok(sessionId, "QA account cleanup requires its own session");
			url.searchParams.set("_clerk_session_id", sessionId);
		}
		// Match the native Clerk SDK's method override for DELETE.
		if (method === "DELETE") url.searchParams.set("_method", "DELETE");
		const response = await fetch(url, {
			method: method === "GET" ? "GET" : "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				...(authorization ? { Authorization: authorization } : {}),
			},
			...(method === "GET" ? {} : { body: new URLSearchParams(form) }),
			signal: AbortSignal.timeout(30_000),
		});
		authorization = response.headers.get("authorization") ?? authorization;
		const data = await response.json();
		if (!response.ok)
			throw new Error(
				`QA Clerk ${path.split("/").at(-1)}: HTTP ${response.status}; ${data.errors?.[0]?.code ?? "unknown"}`,
			);
		return data.response ?? data;
	};
	const rpc = async (kind, path, args = {}) => {
		const token = await clerk(`client/sessions/${sessionId}/tokens/convex`);
		const response = await fetch(`${localUrl}/api/${kind}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token.jwt}`,
			},
			body: JSON.stringify({ path, args, format: "json" }),
			signal: AbortSignal.timeout(30_000),
		});
		const result = await response.json();
		if (result.status !== "success") throw new Error(`Local ${path} failed`);
		return result.value;
	};
	const verify = async (name, expected) => {
		const snapshot = await rpc("query", "contactPreferences:getMine");
		assert.ok(snapshot, "The authenticated contact decision must exist");
		assert.equal(snapshot.version, CONTACT_CONSENT_VERSION);
		for (const [key, value] of Object.entries(expected))
			assert.equal(snapshot[key], value, `${name}: ${key}`);
		results.push({ name, passed: true, revision: snapshot.revision });
		console.log(`Contact QA: ${name} passed`);
	};
	const authenticate = async () => {
		let signIn = await clerk("client/sign_ins", {
			strategy: "password",
			identifier: childEnv.MAESTRO_CI_EMAIL,
			password: childEnv.MAESTRO_CI_PASSWORD,
		});
		if (
			[
				"needs_client_trust",
				"needs_second_factor",
				"needs_first_factor",
			].includes(signIn.status)
		) {
			const first = signIn.status === "needs_first_factor";
			const factor = (
				first ? signIn.supported_first_factors : signIn.supported_second_factors
			)?.find(
				(value) => value.strategy === "email_code" && value.email_address_id,
			);
			assert.ok(
				factor,
				"The development identity must support the test email code",
			);
			const base = `client/sign_ins/${signIn.id}`;
			await clerk(`${base}/prepare_${first ? "first" : "second"}_factor`, {
				strategy: "email_code",
				email_address_id: factor.email_address_id,
			});
			signIn = await clerk(
				`${base}/attempt_${first ? "first" : "second"}_factor`,
				{ strategy: "email_code", code: "424242" },
			);
		}
		assert.equal(signIn.status, "complete");
		assert.ok(signIn.created_session_id);
		sessionId = signIn.created_session_id;
	};
	const journey = (name) => {
		console.log(`Contact QA: starting ${name}`);
		const privateJourney = scenario === "registration";
		const directory = join(
			privateJourney ? privateRoot : publicRoot,
			name,
			".maestro/tests",
		);
		let exitCode;
		try {
			exitCode = runDeviceSmoke(appPath, name, {
				env: childEnv,
				installApp: !appInstalled,
				directory,
			});
		} finally {
			if (privateJourney) {
				// The consumer sanitizes before returning, including on failure.
				// Screenshots may visually contain credentials: never publish them.
				const destination = join(publicRoot, name, ".maestro/tests");
				mkdirSync(destination, { recursive: true });
				for (const file of ["report.xml", "result.json", "redaction.json"]) {
					if (existsSync(join(directory, file)))
						copyFileSync(join(directory, file), join(destination, file));
				}
			}
		}
		if (exitCode !== 0) throw new Error(`${name} native journey failed`);
		appInstalled = true;
		results.push({ name, passed: true });
	};
	try {
		start(["convex", "dev"], "convex");
		await waitFor(
			async () =>
				existsSync(".env.local") && (await fetch(`${localUrl}/version`)).ok,
			"Disposable backend",
		);
		execute(
			"pnpm",
			["exec", "convex", "env", "set", "CLERK_JWT_ISSUER_DOMAIN", issuer],
			"issuer",
		);
		const previous = statSync("convex/auth.config.ts");
		utimesSync("convex/auth.config.ts", previous.atime, new Date());
		if (scenario === "settings") {
			await authenticate();
			await waitFor(async () => {
				await rpc("query", "users:getMe");
				return true;
			}, "Authenticated local functions");
			await rpc("mutation", "users:syncCurrentUser", {
				name: "Contact QA",
				operatingSystem: platform === "ios" ? "iOS" : "Android",
			});
			await rpc("mutation", "users:saveOnboardingAnswers", {
				answers: {
					grade: "10",
					state: "Berlin",
					schoolType: "gymnasium",
					dailySchoolTime: "30 min",
					studyDays: "Montag",
					learningTime: "15:00",
					contact: {
						phone: "",
						feedback: false,
						news: false,
						version: CONTACT_CONSENT_VERSION,
					},
				},
			});
			await verify("Authenticated empty onboarding decision", {
				phone: "",
				feedback: false,
				news: false,
			});
		}
		start(
			[
				"expo",
				"start",
				"--dev-client",
				"--localhost",
				"--max-workers",
				"2",
				"--port",
				"8094",
			],
			"metro",
		);
		await waitFor(async () => (await fetch(`${metroUrl}/status`)).ok, "Metro");
		if (platform === "android") {
			execute("adb", ["reverse", "tcp:3210", "tcp:3210"], "backend-reverse");
			execute("adb", ["reverse", "tcp:8094", "tcp:8094"], "metro-reverse");
		}
		if (scenario === "registration") {
			registrationAttempted = true;
			journey("contact-registration");
			await authenticate();
			await waitFor(async () => {
				const snapshot = await rpc("query", "contactPreferences:getMine");
				return snapshot?.version === CONTACT_CONSENT_VERSION;
			}, "Native registration persistence");
			await verify("Native new-account registration without a number", {
				phone: "",
				feedback: false,
				news: false,
				revision: 1,
			});
			const learningTimes = await rpc("query", "learningTimes:listMine");
			assert.equal(
				learningTimes.length,
				1,
				"Native Monday selection must persist",
			);
			assert.equal(learningTimes[0].dayOfWeek, 1);
			results.push({
				name: "Native onboarding learning day persisted",
				passed: true,
			});
		} else {
			journey("contact-onboarding");
			journey("contact-feedback");
			await verify("Feedback-only native save and relaunch", {
				phone: "+4915123456789",
				feedback: true,
				news: false,
			});
			if (platform === "ios") journey("contact-keyboard");
			journey("contact-news");
			await verify("International number and independent news", {
				phone: "+12015550100",
				feedback: false,
				news: true,
			});
			if (platform === "ios") {
				execute(
					"xcrun",
					["simctl", "ui", "booted", "appearance", "dark"],
					"dark",
				);
				execute(
					"xcrun",
					[
						"simctl",
						"ui",
						"booted",
						"content_size",
						"accessibility-extra-extra-large",
					],
					"large",
				);
			} else {
				execute(
					"adb",
					["shell", "settings", "put", "system", "font_scale", "2.0"],
					"large",
				);
				execute("adb", ["shell", "cmd", "uimode", "night", "yes"], "dark");
			}
			journey("contact-withdraw");
			await verify("Native withdrawal persists and drops unconsented input", {
				phone: "",
				feedback: false,
				news: false,
			});
			journey("contact-onboarding-large");
		}
	} catch (error) {
		failure = error;
	} finally {
		let cleanupError;
		try {
			if (scenario === "registration" && registrationAttempted) {
				// A failed native journey may already have created the account.
				if (!sessionId) await authenticate();
				const user = await clerk(
					"me",
					{},
					{ method: "GET", sessionScoped: true },
				);
				const primary = user.email_addresses?.find(
					(address) => address.id === user.primary_email_address_id,
				);
				assert.ok(
					primary?.email_address === childEnv.MAESTRO_CI_EMAIL,
					"Disposable account identity did not match",
				);
				await clerk("me", {}, { method: "DELETE", sessionScoped: true });
				sessionId = undefined;
				results.push({
					name: "Disposable registration account deleted",
					passed: true,
				});
			} else if (sessionId) await clerk(`client/sessions/${sessionId}/remove`);
		} catch {
			cleanupError =
				scenario === "registration"
					? "Disposable QA account cleanup failed"
					: "QA API session cleanup failed";
		}
		for (const child of children.reverse()) {
			try {
				process.kill(-child.pid, "SIGTERM");
			} catch {
				/* Already exited. */
			}
		}
		writeFileSync(
			join(publicRoot, "acceptance.json"),
			JSON.stringify(
				{
					sourceSha,
					platform,
					scenario,
					completed: !failure && !cleanupError,
					failure: failure?.message,
					results,
					cleanupError,
					limits: [
						scenario === "registration"
							? "No trial activation"
							: "No new Clerk account registration",
						"No manual VoiceOver/TalkBack audio traversal",
					],
				},
				null,
				2,
			),
		);
		if (cleanupError && !failure) failure = new Error(cleanupError);
	}
	if (failure) throw failure;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	runContactPreferencesQa(process.argv[2], {
		scenario: process.argv[3] ?? "settings",
	}).catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
}
