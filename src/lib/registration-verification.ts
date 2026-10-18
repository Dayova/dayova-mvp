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

type CompletedRegistrationCandidate = {
	registrationAttemptId: string | null | undefined;
	clerkUserId: string | null | undefined;
	emailAddress: string | null | undefined;
	sessionId: string | null;
};

export class IncompleteRegistrationIdentityError extends Error {
	constructor() {
		super("Completed registration identity is incomplete.");
		this.name = "IncompleteRegistrationIdentityError";
	}
}

type FinalizeCompletedRegistrationOptions = {
	candidate: CompletedRegistrationCandidate;
	getAccountFingerprint: (emailAddress: string) => Promise<string>;
	bindToUser: FinalizeVerifiedRegistrationOptions["bindToUser"];
	activateSession: FinalizeVerifiedRegistrationOptions["activateSession"];
	onBindingFailure: FinalizeVerifiedRegistrationOptions["onBindingFailure"];
	onIdentityFailure: (
		error: unknown,
		candidate: CompletedRegistrationCandidate,
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
	} finally {
		await activateSession(identity.sessionId);
	}
}

export async function finalizeCompletedRegistration({
	candidate,
	getAccountFingerprint,
	bindToUser,
	activateSession,
	onBindingFailure,
	onIdentityFailure,
}: FinalizeCompletedRegistrationOptions) {
	let identity: VerifiedRegistrationIdentity;
	try {
		if (
			!candidate.registrationAttemptId ||
			!candidate.clerkUserId ||
			!candidate.emailAddress
		) {
			throw new IncompleteRegistrationIdentityError();
		}
		identity = {
			registrationAttemptId: candidate.registrationAttemptId,
			clerkUserId: candidate.clerkUserId,
			accountFingerprint: await getAccountFingerprint(candidate.emailAddress),
			sessionId: candidate.sessionId,
		};
	} catch (error) {
		try {
			onIdentityFailure(error, candidate);
		} finally {
			await activateSession(candidate.sessionId);
		}
		return;
	}

	await finalizeVerifiedRegistration({
		identity,
		bindToUser,
		activateSession,
		onBindingFailure,
	});
}
