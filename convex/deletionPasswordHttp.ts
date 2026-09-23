import type { UserIdentity } from "convex/server";

// Keep the password in the HTTP request only: never persist it as mutation or
// scheduled-action arguments, and never return provider response bodies.
export async function handleDeletionPasswordRequest(
	request: Request,
	dependencies: {
		identity: UserIdentity | null;
		secretKey: string | undefined;
		verify: typeof fetch;
		enqueue: () => Promise<unknown>;
	},
) {
	const reply = (status: number, error: string) =>
		Response.json(
			{ error },
			{ status, headers: { "Cache-Control": "no-store" } },
		);
	if (!dependencies.identity) return reply(401, "Bitte erneut anmelden.");
	if (!dependencies.secretKey)
		return reply(503, "Kontolöschung ist noch nicht konfiguriert.");
	let body: unknown;
	try {
		const text = await request.text();
		if (text.length > 8192) return reply(413, "Ungültige Anfrage.");
		body = JSON.parse(text);
	} catch {
		return reply(400, "Ungültige Anfrage.");
	}
	if (
		!body ||
		typeof body !== "object" ||
		!("password" in body) ||
		typeof body.password !== "string" ||
		!body.password ||
		body.password.length > 4096
	) {
		return reply(400, "Bitte bestätige dein aktuelles Passwort.");
	}
	try {
		const response = await dependencies.verify(
			`https://api.clerk.com/v1/users/${encodeURIComponent(dependencies.identity.subject)}/verify_password`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${dependencies.secretKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ password: body.password }),
				signal: AbortSignal.timeout(10_000),
			},
		);
		if (response.status === 429)
			return reply(429, "Bitte warte kurz und versuche es erneut.");
		if (!response.ok)
			return reply(403, "Das Passwort konnte nicht bestätigt werden.");
		const proof: unknown = await response.json();
		if (
			!proof ||
			typeof proof !== "object" ||
			!("verified" in proof) ||
			proof.verified !== true
		) {
			return reply(403, "Das Passwort konnte nicht bestätigt werden.");
		}
	} catch {
		return reply(
			503,
			"Die Passwortprüfung ist vorübergehend nicht erreichbar.",
		);
	}
	return Response.json(await dependencies.enqueue(), {
		headers: { "Cache-Control": "no-store" },
	});
}
