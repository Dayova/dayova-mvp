const pendingKey = "pendingPrimaryEmailReplacement";

type EmailAddress = {
	id: string;
	verification?: { status: string | null } | null;
	destroy: () => Promise<void>;
};

export type EmailReplacementUser = {
	primaryEmailAddress: { id: string } | null;
	emailAddresses: EmailAddress[];
	unsafeMetadata: Record<string, unknown>;
	update: (params: { primaryEmailAddressId: string }) => Promise<unknown>;
	updateMetadata: (params: {
		unsafeMetadata: Record<string, unknown>;
	}) => Promise<unknown>;
};

type PendingReplacement = { previousId: string; nextId: string };
export type EmailReplacementResult =
	| "complete"
	| "activation_pending"
	| "cleanup_pending";

export function getPendingEmailReplacement(
	user: Pick<EmailReplacementUser, "unsafeMetadata">,
): PendingReplacement | null {
	const value = user.unsafeMetadata[pendingKey];
	if (!value || typeof value !== "object") return null;
	const { previousId, nextId } = value as Record<string, unknown>;
	return typeof previousId === "string" &&
		typeof nextId === "string" &&
		previousId !== nextId
		? { previousId, nextId }
		: null;
}

async function removePreviousEmail(
	user: EmailReplacementUser,
	{ previousId }: PendingReplacement,
): Promise<EmailReplacementResult> {
	const previous = user.emailAddresses.find((email) => email.id === previousId);
	if (previous) {
		try {
			await previous.destroy();
		} catch {
			return "cleanup_pending";
		}
	}
	// If clearing the marker fails, the next sign-in will safely retry it.
	try {
		await user.updateMetadata({ unsafeMetadata: { [pendingKey]: null } });
	} catch {
		// The old address is already gone; the replacement itself is complete.
	}
	return "complete";
}

async function discardPendingReplacement(
	user: EmailReplacementUser,
): Promise<EmailReplacementResult> {
	try {
		await user.updateMetadata({ unsafeMetadata: { [pendingKey]: null } });
		return "complete";
	} catch {
		return "cleanup_pending";
	}
}

export async function replacePrimaryEmail(
	user: EmailReplacementUser,
	previousId: string,
	nextId: string,
): Promise<EmailReplacementResult> {
	if (previousId === nextId) return "complete";
	if (user.primaryEmailAddress?.id !== previousId) {
		throw new Error(
			"Die primäre E-Mail-Adresse hat sich geändert. Bitte erneut laden.",
		);
	}
	const next = user.emailAddresses.find((email) => email.id === nextId);
	if (next?.verification?.status !== "verified") {
		throw new Error("Die neue E-Mail-Adresse ist noch nicht bestätigt.");
	}
	const pending = getPendingEmailReplacement(user);
	if (pending) {
		throw new Error(
			"Der vorherige E-Mail-Wechsel ist noch nicht abgeschlossen. Bitte starte die App neu und versuche es erneut.",
		);
	}
	const replacement = { previousId, nextId };
	await user.updateMetadata({
		unsafeMetadata: { [pendingKey]: replacement },
	});
	try {
		await user.update({ primaryEmailAddressId: nextId });
	} catch {
		return "activation_pending";
	}
	return removePreviousEmail(user, replacement);
}

export async function resumePrimaryEmailReplacement(
	user: EmailReplacementUser,
): Promise<EmailReplacementResult> {
	const replacement = getPendingEmailReplacement(user);
	if (!replacement) return "complete";
	const currentId = user.primaryEmailAddress?.id;
	if (currentId === replacement.previousId) {
		const next = user.emailAddresses.find(
			(email) => email.id === replacement.nextId,
		);
		if (!next) return discardPendingReplacement(user);
		if (next.verification?.status !== "verified") return "cleanup_pending";
		try {
			await user.update({ primaryEmailAddressId: replacement.nextId });
		} catch {
			return "activation_pending";
		}
	} else if (currentId !== replacement.nextId) {
		// Another primary address superseded this replacement. Never delete the old one.
		return discardPendingReplacement(user);
	}
	return removePreviousEmail(user, replacement);
}
