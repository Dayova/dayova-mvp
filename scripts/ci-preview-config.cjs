const CLERK_ISSUER = "https://warm-parrot-13.clerk.accounts.dev";

function previewConfiguration(env) {
	const url = env.EXPO_PUBLIC_CONVEX_URL;
	const previewName = env.CI_CONVEX_PREVIEW_NAME;
	const sourceSha = env.CI_CONVEX_SOURCE_SHA;
	const clerkKey = env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
	const issuer = clerkKey?.startsWith("pk_test_")
		? "https://" +
			Buffer.from(clerkKey.slice(8), "base64").toString().replace(/\$$/, "")
		: "";
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		/* Checked below. */
	}
	if (
		env.APP_VARIANT !== "preview" ||
		issuer !== CLERK_ISSUER ||
		!/^[a-f0-9]{40}$/.test(sourceSha ?? "") ||
		!new RegExp(`^ci-${sourceSha?.slice(0, 12)}-[a-f0-9]{12}$`).test(
			previewName ?? "",
		) ||
		!parsed ||
		parsed.protocol !== "https:" ||
		`${parsed.origin}/` !== parsed.href ||
		!/^[a-z0-9-]+\.eu-west-1\.convex\.cloud$/.test(parsed.hostname) ||
		["resilient-pika-316", "kindred-canary-599"].some((name) =>
			parsed.hostname.startsWith(`${name}.`),
		) ||
		env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim()
	)
		throw new Error(
			"CI validation requires a commit-matched Convex preview, the reviewed Clerk test instance and disabled analytics.",
		);
	return { url: parsed.origin, previewName, sourceSha };
}

module.exports = { CLERK_ISSUER, previewConfiguration };

// EAS build:internal reloads saved variables after the initial worker config.
// Pin only public candidate provenance in the worker's CI profile so that
// reload and every later native bundling subprocess use the checked backend.
if (require.main === module) {
	if (process.argv[2] !== "pin-build") throw new Error("Expected pin-build.");
	const { readFileSync, writeFileSync } = require("node:fs");
	const preview = previewConfiguration(process.env);
	const config = JSON.parse(readFileSync("eas.json", "utf8"));
	const profile = config.build?.ci;
	if (
		profile?.env?.DAYOVA_CI_VALIDATION !== "true" ||
		profile.env.APP_VARIANT !== "preview"
	) {
		throw new Error("Only the isolated ci build profile can be pinned.");
	}
	profile.env = {
		...profile.env,
		EXPO_PUBLIC_CONVEX_URL: preview.url,
		CI_CONVEX_PREVIEW_NAME: preview.previewName,
		CI_CONVEX_SOURCE_SHA: preview.sourceSha,
	};
	writeFileSync("eas.json", `${JSON.stringify(config, null, 2)}\n`);
}
