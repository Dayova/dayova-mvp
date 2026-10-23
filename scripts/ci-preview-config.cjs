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
