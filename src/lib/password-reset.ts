type ClerkOperationResult = {
	error: unknown | null;
};

type PasswordResetCodeStage = "reset_code" | "second_factor";

type PasswordResetSignIn = {
	readonly status: string | null;
	reset: () => Promise<ClerkOperationResult>;
	create: (params: { identifier: string }) => Promise<ClerkOperationResult>;
	resetPasswordEmailCode: {
		sendCode: () => Promise<ClerkOperationResult>;
		verifyCode: (params: { code: string }) => Promise<ClerkOperationResult>;
		submitPassword: (params: {
			password: string;
			signOutOfOtherSessions: boolean;
		}) => Promise<ClerkOperationResult>;
	};
	mfa: {
		sendEmailCode: () => Promise<ClerkOperationResult>;
		verifyEmailCode: (params: {
			code: string;
		}) => Promise<ClerkOperationResult>;
	};
	finalize: () => Promise<ClerkOperationResult>;
};

async function runClerkOperation(operation: Promise<ClerkOperationResult>) {
	const { error } = await operation;
	if (error) throw error;
}

const isUnknownIdentifierError = (error: unknown) => {
	if (typeof error !== "object" || error === null || !("errors" in error)) {
		return false;
	}

	const { errors } = error as { errors?: unknown };
	return (
		Array.isArray(errors) &&
		errors.some(
			(item) =>
				typeof item === "object" &&
				item !== null &&
				"code" in item &&
				item.code === "form_identifier_not_found",
		)
	);
};

async function startPasswordReset(signIn: PasswordResetSignIn, email: string) {
	await runClerkOperation(signIn.reset());
	const creation = await signIn.create({
		identifier: email.trim().toLowerCase(),
	});
	if (isUnknownIdentifierError(creation.error)) {
		return { status: "delivery_not_confirmed" as const };
	}
	if (creation.error) throw creation.error;
	await runClerkOperation(signIn.resetPasswordEmailCode.sendCode());
	return { status: "code_sent" as const };
}

async function verifyPasswordResetCode(
	signIn: PasswordResetSignIn,
	code: string,
) {
	await runClerkOperation(
		signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() }),
	);
	if (signIn.status !== "needs_new_password") {
		throw new Error("Der Code konnte nicht bestätigt werden.");
	}
}

async function completePasswordReset(
	signIn: PasswordResetSignIn,
	password: string,
): Promise<{ status: "complete" | "needs_second_factor" }> {
	await runClerkOperation(
		signIn.resetPasswordEmailCode.submitPassword({
			password,
			signOutOfOtherSessions: true,
		}),
	);

	if (signIn.status === "complete") {
		await runClerkOperation(signIn.finalize());
		return { status: "complete" };
	}

	if (
		signIn.status === "needs_second_factor" ||
		signIn.status === "needs_client_trust"
	) {
		await runClerkOperation(signIn.mfa.sendEmailCode());
		return { status: "needs_second_factor" };
	}

	throw new Error("Das neue Passwort konnte nicht aktiviert werden.");
}

async function verifyPasswordResetSecondFactor(
	signIn: PasswordResetSignIn,
	code: string,
) {
	await runClerkOperation(signIn.mfa.verifyEmailCode({ code: code.trim() }));
	if (signIn.status !== "complete") {
		throw new Error(
			"Die Sicherheitsprüfung konnte nicht abgeschlossen werden.",
		);
	}
	await runClerkOperation(signIn.finalize());
}

async function resendPasswordResetCode(
	signIn: PasswordResetSignIn,
	stage: PasswordResetCodeStage,
	hasRemoteResetAttempt: boolean,
) {
	if (stage === "reset_code" && !hasRemoteResetAttempt) return;
	await runClerkOperation(
		stage === "reset_code"
			? signIn.resetPasswordEmailCode.sendCode()
			: signIn.mfa.sendEmailCode(),
	);
}

async function cancelPasswordReset(signIn: PasswordResetSignIn) {
	await runClerkOperation(signIn.reset());
}

export type { PasswordResetCodeStage, PasswordResetSignIn };
export {
	cancelPasswordReset,
	completePasswordReset,
	resendPasswordResetCode,
	startPasswordReset,
	verifyPasswordResetCode,
	verifyPasswordResetSecondFactor,
};
