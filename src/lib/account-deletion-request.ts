import {
	type PasswordReverificationSession,
	reverifyPasswordFactor,
} from "./password-reverification";

type DeletionSession = PasswordReverificationSession & {
	getToken: (options: {
		template: "convex";
		skipCache: true;
	}) => Promise<string | null>;
};

/** A server response already contains a safe deletion-specific UI message. */
export class AccountDeletionResponseError extends Error {}

export async function readAccountDeletionResponse(
	response: Response,
): Promise<unknown> {
	if (!response.ok) {
		const body: unknown = await response.json().catch(() => null);
		const message =
			body &&
			typeof body === "object" &&
			"error" in body &&
			typeof body.error === "string" &&
			body.error.trim()
				? body.error
				: "Die Kontolöschung konnte nicht bestätigt werden. Bitte versuche es erneut.";
		throw new AccountDeletionResponseError(message);
	}
	return response.json();
}

export async function submitAccountDeletion(
	dependencies: {
		session: DeletionSession;
		request: (token: string) => Promise<unknown>;
		logout: () => Promise<void>;
	},
	password: string,
) {
	if (!password) throw new Error("Bitte bestätige dein aktuelles Passwort.");
	await reverifyPasswordFactor(dependencies.session, password);
	// Do not reuse the pre-verification JWT held by the realtime connection.
	const token = await dependencies.session.getToken({
		template: "convex",
		skipCache: true,
	});
	if (!token)
		throw new Error("Bitte melde dich erneut an und versuche es noch einmal.");
	const result = await dependencies.request(token);
	if (
		!result ||
		typeof result !== "object" ||
		!("status" in result) ||
		result.status !== "accepted"
	) {
		throw new Error(
			"Der Löschauftrag wurde nicht bestätigt. Bitte melde dich erneut an und versuche es noch einmal.",
		);
	}
	// Accepted means queued, not that all external processors have finished.
	await dependencies.logout();
}
