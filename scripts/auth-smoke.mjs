import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

// Only the reviewed development tenant and synthetic test-email identities.
export async function authenticatedSmoke(env = process.env, request = fetch) {
	const {
		EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: key,
		EXPO_PUBLIC_CONVEX_URL: convexUrl,
		MAESTRO_CI_EMAIL: email,
		MAESTRO_CI_PASSWORD: password,
	} = env;
	const host = key?.startsWith("pk_test_")
		? Buffer.from(key.slice(8), "base64").toString().replace(/\$$/, "")
		: "";
	if (
		host !== "warm-parrot-13.clerk.accounts.dev" ||
		convexUrl !== "https://resilient-pika-316.eu-west-1.convex.cloud" ||
		!email?.includes("+clerk_test@") ||
		!password
	)
		throw new Error(
			"Authenticated smoke requires the isolated development tenant and a configured synthetic identity",
		);
	let authorization;
	let sessionId;
	let stage = "configuration";
	let primaryError;
	let outcome;
	const clerk = async (path, form) => {
		stage = `clerk:${path.split("/").at(-1)}`;
		const response = await request(
			`https://${host}/v1/${path}?_is_native=true`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					...(authorization ? { Authorization: authorization } : {}),
				},
				body: new URLSearchParams(form),
				signal: AbortSignal.timeout(30_000),
			},
		);
		authorization = response.headers.get("authorization") ?? authorization;
		const data = await response.json();
		if (!response.ok)
			throw new Error(
				`Clerk ${path.split("/").at(-1)} failed (HTTP ${response.status}; ${data.errors?.[0]?.code ?? "unknown"})`,
			);
		return data.response ?? data;
	};
	const me = async (token) => {
		stage = token ? "authenticated-convex-query" : "anonymous-convex-query";
		const response = await request(`${convexUrl}/api/query`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			body: JSON.stringify({ path: "users:getMe", args: {}, format: "json" }),
			signal: AbortSignal.timeout(30_000),
		});
		if (!response.ok && response.status !== 560)
			throw new Error(`Convex query failed (HTTP ${response.status})`);
		return response.json();
	};
	try {
		const denied = await me();
		if (denied.status !== "error")
			throw new Error("Unauthenticated Convex access was not denied");
		let signIn = await clerk("client/sign_ins", {
			strategy: "password",
			identifier: email,
			password,
		});
		if (
			[
				"needs_client_trust",
				"needs_second_factor",
				"needs_first_factor",
			].includes(signIn.status)
		) {
			const firstFactor = signIn.status === "needs_first_factor";
			const factor = (
				firstFactor
					? signIn.supported_first_factors
					: signIn.supported_second_factors
			)?.find(
				(value) => value.strategy === "email_code" && value.email_address_id,
			);
			if (!factor)
				throw new Error(
					"The test account requires an unsupported verification factor",
				);
			const base = `client/sign_ins/${signIn.id}`;
			await clerk(
				`${base}/prepare_${firstFactor ? "first" : "second"}_factor`,
				{ strategy: "email_code", email_address_id: factor.email_address_id },
			);
			signIn = await clerk(
				`${base}/attempt_${firstFactor ? "first" : "second"}_factor`,
				{ strategy: "email_code", code: "424242" },
			);
		}
		if (signIn.status !== "complete" || !signIn.created_session_id)
			throw new Error(`Clerk sign-in did not complete (${signIn.status})`);
		sessionId = signIn.created_session_id;
		const token = await clerk(`client/sessions/${sessionId}/tokens/convex`, {});
		if (!token.jwt) throw new Error("Clerk did not issue the Convex JWT");
		const result = await me(token.jwt);
		if (
			result.status !== "success" ||
			!result.value?._id ||
			result.value.email !== email
		)
			throw new Error(
				"The deployed Convex backend did not return the authenticated synthetic user",
			);
		outcome = {
			clerkSignIn: "success",
			authenticatedConvexQuery: "success",
			unauthenticatedConvexQuery: "denied",
		};
	} catch (error) {
		primaryError = Object.assign(error, { smokeStage: stage });
	}
	if (sessionId) {
		try {
			await clerk(`client/sessions/${sessionId}/remove`, {});
		} catch (error) {
			if (primaryError) primaryError.cleanupFailed = true;
			else
				primaryError = Object.assign(error, {
					smokeStage: "clerk-session-cleanup",
				});
		}
	}
	if (primaryError) throw primaryError;
	return outcome;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const start = performance.now();
	let result;
	try {
		result = {
			status: "success",
			...(await authenticatedSmoke()),
		};
	} catch (error) {
		let message = error.message;
		for (const value of [
			process.env.MAESTRO_CI_EMAIL,
			process.env.MAESTRO_CI_PASSWORD,
		])
			if (value) message = message.replaceAll(value, "[redacted]");
		result = {
			status: "failure",
			stage: error.smokeStage ?? "configuration",
			error: message,
			cleanupFailed: Boolean(error.cleanupFailed),
		};
		process.exitCode = 1;
	}
	result.seconds = (performance.now() - start) / 1000;
	mkdirSync(".maestro/artifacts/ci", { recursive: true });
	writeFileSync(
		".maestro/artifacts/ci/auth-smoke.json",
		JSON.stringify(result, null, 2),
	);
	console.log(JSON.stringify(result));
}
