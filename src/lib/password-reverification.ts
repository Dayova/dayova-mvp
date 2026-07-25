type VerificationStatus = "complete" | string;

type FirstFactor = {
	strategy: string;
};

type VerificationResult = {
	status: VerificationStatus;
	supportedFirstFactors?: FirstFactor[] | null;
};

export type PasswordReverificationSession = {
	startVerification: (input: {
		level: "first_factor";
	}) => Promise<VerificationResult>;
	attemptFirstFactorVerification: (input: {
		strategy: "password";
		password: string;
	}) => Promise<VerificationResult>;
};

export const reverifyPasswordFactor = async (
	session: PasswordReverificationSession,
	currentPassword: string,
) => {
	const verification = await session.startVerification({
		level: "first_factor",
	});
	if (verification.status === "complete") return;

	const supportsPassword = verification.supportedFirstFactors?.some(
		(factor) => factor.strategy === "password",
	);
	if (!supportsPassword) {
		throw new Error(
			"Die Passwortprüfung ist für dieses Konto nicht verfügbar. Bitte erneut anmelden und noch einmal versuchen.",
		);
	}

	const result = await session.attemptFirstFactorVerification({
		strategy: "password",
		password: currentPassword,
	});
	if (result.status !== "complete") {
		throw new Error(
			"Das aktuelle Passwort konnte nicht bestätigt werden. Bitte erneut anmelden und noch einmal versuchen.",
		);
	}
};
