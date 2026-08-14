export type VerifiedRegistrationIdentity = {
	registrationAttemptId: string;
	clerkUserId: string;
	accountFingerprint: string;
	sessionId: string | null;
};

type FinalizeVerifiedRegistrationOptions = {
	identity: VerifiedRegistrationIdentity;
	bindToUser: (identity: {
		registrationAttemptId: string;
		clerkUserId: string;
		accountFingerprint: string;
	}) => Promise<void>;
	activateSession: (sessionId: string | null) => Promise<void>;
	onBindingFailure: (
		error: unknown,
		identity: VerifiedRegistrationIdentity,
	) => void;
};

export async function finalizeVerifiedRegistration({
	identity,
	bindToUser,
	activateSession,
	onBindingFailure,
}: FinalizeVerifiedRegistrationOptions) {
	try {
		await bindToUser(identity);
	} catch (error) {
		onBindingFailure(error, identity);
	}
	await activateSession(identity.sessionId);
}
