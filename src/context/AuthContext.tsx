import {
	isClerkAPIResponseError,
	useClerk,
	useSignIn,
	useUser,
} from "@clerk/expo";
import { useConvexAuth, useMutation } from "convex/react";
import { usePostHog } from "posthog-react-native";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import { api } from "#convex/_generated/api";
import { useOnboarding } from "~/context/OnboardingContext";
import {
	createValidationAnalytics,
	isPostHogConfigured,
} from "~/lib/analytics";
import { runWithAuthSettleRetries } from "~/lib/auth-settle-retry";
import type { OnboardingCompletionStatus } from "~/lib/auth-routing";
import {
	getDefinedProfileFields as definedProfileFields,
	prepareClerkRegistration,
	type ClerkRegistrationInput as RegisterInput,
	type ClerkProfile as RegisterProfile,
	splitClerkName as splitName,
} from "~/lib/clerk-registration";
import { getDayKey } from "~/lib/day-key";
import { logDiagnosticError } from "~/lib/diagnostics";
import {
	type ForcedPasswordResetUser,
	completeForcedPasswordReset as submitForcedPasswordReset,
} from "~/lib/forced-password-reset";
import { isSupportedGrade } from "~/lib/grades";
import { signOutAndResetState } from "~/lib/logout-state";
import {
	finalizePendingOnboardingCompletion,
	getPendingOnboardingSyncTransition,
	PendingOnboardingSyncError,
	type PendingOnboardingSyncAnswers,
	type PendingOnboardingSyncResumeResult,
	syncPendingOnboardingAnswers,
} from "~/lib/pending-onboarding-sync";
import {
	getOnboardingAccountFingerprint,
	pendingOnboardingSyncOutbox,
} from "~/lib/pending-onboarding-sync-secure-store";
import {
	finalizeCompletedRegistration,
	IncompleteRegistrationIdentityError,
} from "~/lib/registration-verification";
import {
	type PasswordChangeInput,
	changePassword as updateAccountPassword,
} from "~/lib/password-change";
import {
	clearOwnedPostAuthSyncFailure,
	getOnboardingRecoveryOwnedBoundary,
	retryPostAuthSyncFailure,
	type PostAuthSyncFailure,
} from "~/lib/post-auth-sync-failure";
import {
	startPasswordReset as beginPasswordReset,
	cancelPasswordReset as cancelPasswordResetAttempt,
	type PasswordResetCodeStage,
	resendPasswordResetCode as resendPasswordResetAttempt,
	completePasswordReset as submitPasswordReset,
	verifyPasswordResetCode as verifyPasswordResetAttempt,
	verifyPasswordResetSecondFactor as verifyPasswordResetSecondFactorAttempt,
} from "~/lib/password-reset";
import {
	type PasswordReverificationSession,
	reverifyPasswordFactor,
} from "~/lib/password-reverification";
import {
	isSupportedSchoolType,
	normalizeLegacySchoolType,
	type SupportedSchoolType,
} from "~/lib/school-types";

type LoginInput = {
	email: string;
	password: string;
};

type UpdateProfileInput = {
	email: string;
	name: string;
	birthDate: string;
	grade: string;
	schoolType?: SupportedSchoolType;
	state: string;
};

type AuthUser = {
	clerkId: string;
	email: string;
	name?: string;
	phone?: string;
	birthDate?: string;
	grade?: string;
	schoolType?: SupportedSchoolType;
	state?: string;
	avatarUrl?: string;
	validationStudentCode?: string;
	onboardingRegistrationAttemptId?: string;
};

type AuthFlowResult =
	| { status: "complete" }
	| { status: "needs_verification"; message: string };

type ProfileUpdateResult =
	| { status: "complete" }
	| { status: "needs_email_verification"; message: string };

type PendingVerification =
	| { mode: "login"; email: string }
	| { mode: "register"; email: string; registrationAttemptId: string };

type PendingLoginStage = "first_factor" | "second_factor";

interface AuthSessionContextType {
	user: AuthUser | null;
	isSessionLoading: boolean;
	isConvexAuthenticated: boolean;
	isConvexUserSynced: boolean;
	isPostAuthSyncing: boolean;
	postAuthSyncError: string | null;
	retryPostAuthSync: () => void;
	onboardingCompletionStatus: OnboardingCompletionStatus;
	completeOnboardingHandoff: () => Promise<boolean>;
	pendingSessionTask: string | null;
}

interface AuthFlowContextType {
	isLoading: boolean;
	pendingVerification: PendingVerification | null;
	login: (input: LoginInput) => Promise<AuthFlowResult>;
	startRegistrationWithEmail: (email: string) => Promise<void>;
	register: (input: RegisterInput) => Promise<AuthFlowResult>;
	stageOnboardingRecovery: (
		answers: PendingOnboardingSyncAnswers,
	) => Promise<void>;
	replaceOnboardingRecoveryAnswers: (
		answers: PendingOnboardingSyncAnswers,
	) => Promise<void>;
	verifyEmailCode: (code: string) => Promise<AuthFlowResult>;
	resendVerification: () => Promise<void>;
	startPasswordReset: (email: string) => Promise<void>;
	verifyPasswordResetCode: (code: string) => Promise<void>;
	completePasswordReset: (
		password: string,
	) => Promise<{ status: "complete" | "needs_second_factor" }>;
	verifyPasswordResetSecondFactor: (code: string) => Promise<void>;
	resendPasswordResetCode: (stage: PasswordResetCodeStage) => Promise<void>;
	cancelPasswordReset: () => Promise<void>;
}

interface AccountActionsContextType {
	isLoading: boolean;
	updateProfile: (input: UpdateProfileInput) => Promise<ProfileUpdateResult>;
	verifyProfileEmailCode: (code: string) => Promise<void>;
	changePassword: (input: PasswordChangeInput) => Promise<void>;
	completeForcedPasswordReset: (password: string) => Promise<void>;
	logout: () => Promise<void>;
}

type PendingProfileEmail = {
	email: string;
	emailAddress: {
		id: string;
		attemptVerification: (params: { code: string }) => Promise<{ id: string }>;
	};
	profile: UpdateProfileInput;
};

const AuthSessionContext = createContext<AuthSessionContextType | undefined>(
	undefined,
);
const AuthFlowContext = createContext<AuthFlowContextType | undefined>(
	undefined,
);
const AccountActionsContext = createContext<
	AccountActionsContextType | undefined
>(undefined);

const POST_AUTH_SYNC_ERROR_MESSAGES: Record<PostAuthSyncFailure, string> = {
	restore:
		"Deine gespeicherten Angaben konnten gerade nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.",
	completion:
		"Der Übergang zur Testphase konnte noch nicht abgeschlossen werden. Bitte versuche es erneut.",
	profile:
		"Deine Angaben konnten noch nicht gespeichert werden. Prüfe deine Verbindung und versuche es erneut.",
	answers:
		"Deine Angaben konnten noch nicht gespeichert werden. Prüfe deine Verbindung und versuche es erneut.",
};

const getMetadataString = (metadata: Record<string, unknown>, key: string) =>
	typeof metadata[key] === "string" ? metadata[key] : undefined;

const normalizeOptionalSchoolTypeInput = (
	value: unknown,
): SupportedSchoolType | undefined => {
	if (typeof value !== "string" || value.trim().length === 0) return undefined;
	const normalizedValue = value.trim();
	if (!isSupportedSchoolType(normalizedValue)) {
		throw new Error("Bitte wähle eine gültige Schulart aus.");
	}
	return normalizedValue;
};

const getGermanClerkErrorByCode = (code?: string) => {
	switch (code) {
		case "form_identifier_not_found":
			return "Wir konnten kein Konto mit diesen Daten finden. Bitte prüfe deine E-Mail-Adresse und dein Passwort.";
		case "form_password_incorrect":
			return "E-Mail oder Passwort ist falsch.";
		case "form_identifier_exists":
		case "form_email_address_exists":
			return "Für diese E-Mail-Adresse gibt es bereits ein Konto.";
		case "form_identifier_invalid":
		case "form_param_format_invalid":
			return "Bitte gib eine gültige E-Mail-Adresse ein.";
		case "form_password_length_too_short":
			return "Das Passwort ist zu kurz.";
		case "form_password_validation_failed":
			return "Das Passwort erfüllt die Anforderungen nicht.";
		case "form_password_pwned":
			return "Dieses Passwort wurde in einem Datenleck gefunden. Bitte wähle ein anderes.";
		case "verification_failed":
		case "verification_invalid":
			return "Der Code ist ungültig. Bitte prüfe ihn und versuche es erneut.";
		case "verification_expired":
			return "Der Code ist abgelaufen. Bitte fordere einen neuen Code an.";
		case "too_many_requests":
		case "rate_limit_exceeded":
			return "Zu viele Versuche. Bitte warte kurz und versuche es erneut.";
		default:
			return null;
	}
};

const getGermanAuthErrorMessage = (
	message: string,
	fallback: string,
	options: { allowOriginal?: boolean } = {},
) => {
	const normalized = message.trim().replace(/\s+/g, " ").toLowerCase();
	if (!normalized) return fallback;
	const allowOriginal = options.allowOriginal ?? true;

	if (
		normalized.includes("couldn't find your account") ||
		normalized.includes("could not find your account") ||
		normalized.includes("account not found") ||
		normalized.includes("user not found")
	) {
		return "Wir konnten kein Konto mit diesen Daten finden. Bitte prüfe deine E-Mail-Adresse und dein Passwort.";
	}

	if (
		normalized.includes("password is incorrect") ||
		normalized.includes("incorrect password") ||
		normalized.includes("invalid password")
	) {
		return "E-Mail oder Passwort ist falsch.";
	}

	if (
		normalized.includes("email address is taken") ||
		normalized.includes("already exists") ||
		normalized.includes("identifier already exists")
	) {
		return "Für diese E-Mail-Adresse gibt es bereits ein Konto.";
	}

	if (
		normalized.includes("identifier is invalid") ||
		normalized.includes("email address is invalid") ||
		normalized.includes("invalid email")
	) {
		return "Bitte gib eine gültige E-Mail-Adresse ein.";
	}

	if (
		normalized.includes("verification code is invalid") ||
		normalized.includes("code is invalid") ||
		normalized.includes("verification failed")
	) {
		return "Der Code ist ungültig. Bitte prüfe ihn und versuche es erneut.";
	}

	if (normalized.includes("expired") && normalized.includes("code")) {
		return "Der Code ist abgelaufen. Bitte fordere einen neuen Code an.";
	}

	if (
		normalized.includes("too many requests") ||
		normalized.includes("rate limit")
	) {
		return "Zu viele Versuche. Bitte warte kurz und versuche es erneut.";
	}

	if (
		normalized.includes("network request failed") ||
		normalized.includes("failed to fetch")
	) {
		return "Verbindung fehlgeschlagen. Bitte prüfe deine Internetverbindung und versuche es erneut.";
	}

	if (normalized.includes("server error")) {
		return fallback;
	}

	if (normalized.includes("password") && normalized.includes("too short")) {
		return "Das Passwort ist zu kurz.";
	}

	if (normalized.includes("password") && normalized.includes("breach")) {
		return "Dieses Passwort wurde in einem Datenleck gefunden. Bitte wähle ein anderes.";
	}

	return allowOriginal ? message : fallback;
};

const getClerkErrorMessage = (error: unknown, fallback: string) => {
	if (isClerkAPIResponseError(error)) {
		const clerkError = error.errors[0];
		return (
			getGermanClerkErrorByCode(clerkError?.code) ??
			getGermanAuthErrorMessage(
				clerkError?.longMessage ?? clerkError?.message ?? "",
				fallback,
				{
					allowOriginal: false,
				},
			)
		);
	}
	return error instanceof Error
		? getGermanAuthErrorMessage(error.message, fallback)
		: fallback;
};

const getPasswordChangeErrorMessage = (error: unknown) => {
	if (
		isClerkAPIResponseError(error) &&
		error.errors.some(({ code }) => code === "form_password_incorrect")
	) {
		return "Das aktuelle Passwort ist falsch.";
	}

	return getClerkErrorMessage(
		error,
		"Das Passwort konnte nicht geändert werden. Bitte versuche es erneut.",
	);
};

const findEmailAddressId = (factors: unknown) => {
	if (!Array.isArray(factors)) return null;
	const factor = factors.find(
		(item): item is { strategy: "email_code"; emailAddressId: string } =>
			typeof item === "object" &&
			item !== null &&
			"strategy" in item &&
			item.strategy === "email_code" &&
			"emailAddressId" in item &&
			typeof item.emailAddressId === "string",
	);
	return factor?.emailAddressId ?? null;
};

const getAuthFactorDescription = (factor: unknown) => {
	if (
		typeof factor !== "object" ||
		factor === null ||
		!("strategy" in factor) ||
		typeof factor.strategy !== "string"
	) {
		return null;
	}

	const labelByStrategy: Record<string, string> = {
		backup_code: "Backup-Code",
		email_code: "E-Mail-Code",
		email_link: "E-Mail-Link",
		enterprise_sso: "SSO",
		passkey: "Passkey",
		password: "Passwort",
		phone_code: "SMS-Code",
		reset_password_email_code: "Passwort-Zurücksetzung per E-Mail",
		reset_password_phone_code: "Passwort-Zurücksetzung per SMS",
		totp: "Authenticator-App",
		web3_metamask_signature: "Web3-Wallet",
	};
	const label = labelByStrategy[factor.strategy] ?? factor.strategy;
	const safeIdentifier =
		"safeIdentifier" in factor && typeof factor.safeIdentifier === "string"
			? factor.safeIdentifier
			: null;

	return safeIdentifier ? `${label} (${safeIdentifier})` : label;
};

const getAuthFactorList = (factors: unknown) => {
	if (!Array.isArray(factors)) return "keine unterstützte Methode";
	const descriptions = factors
		.map(getAuthFactorDescription)
		.filter((description): description is string => Boolean(description));
	return descriptions.length > 0
		? descriptions.join(", ")
		: "keine unterstützte Methode";
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const clerk = useClerk();
	const { signIn: passwordResetSignIn } = useSignIn();
	const posthog = usePostHog();
	const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const syncCurrentUser = useMutation(api.users.syncCurrentUser);
	const saveOnboardingAnswers = useMutation(api.users.saveOnboardingAnswers);
	const markValidationActivity = useMutation(
		api.validationAnalytics.markActivity,
	);
	const updateConvexProfile = useMutation(api.users.updateProfile);
	const { clearAnswers } = useOnboarding();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const passwordResetHasRemoteAttemptRef = useRef(false);
	const verificationRecoveryRef = useRef<{
		registrationAttemptId: string;
		clerkUserId: string;
		accountFingerprint: string;
	} | null>(null);
	const [pendingVerification, setPendingVerification] =
		useState<PendingVerification | null>(null);
	const [pendingLoginStage, setPendingLoginStage] =
		useState<PendingLoginStage | null>(null);
	const [pendingProfile, setPendingProfile] = useState<RegisterProfile | null>(
		null,
	);
	const [pendingProfileEmail, setPendingProfileEmail] =
		useState<PendingProfileEmail | null>(null);
	const [isProfileSyncing, setIsProfileSyncing] = useState(false);
	const [isOnboardingAnswersSyncing, setIsOnboardingAnswersSyncing] =
		useState(false);
	const [postAuthSyncFailure, setPostAuthSyncFailure] =
		useState<PostAuthSyncFailure | null>(null);
	const [onboardingCompletion, setOnboardingCompletion] = useState<{
		clerkUserId: string | null;
		accountFingerprint: string | null;
		result:
			| PendingOnboardingSyncResumeResult
			| { status: "loading" | "storage_error" };
	}>({
		clerkUserId: null,
		accountFingerprint: null,
		result: { status: "loading" },
	});
	const [onboardingRestoreAttempt, retryOnboardingRestore] = useReducer(
		(attempt: number) => attempt + 1,
		0,
	);
	const [profileSyncAttempt, retryProfileSync] = useReducer(
		(attempt: number) => attempt + 1,
		0,
	);
	const [answersSyncAttempt, retryAnswersSync] = useReducer(
		(attempt: number) => attempt + 1,
		0,
	);
	const [syncedClerkUserId, setSyncedClerkUserId] = useState<string | null>(
		null,
	);

	const user = useMemo<AuthUser | null>(() => {
		if (!clerkUser) return null;

		const unsafeMetadata = clerkUser.unsafeMetadata ?? {};
		const clerkName =
			clerkUser.fullName ??
			[clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ");
		const name =
			clerkName.trim().length > 0
				? clerkName
				: getMetadataString(unsafeMetadata, "name");
		const schoolType = normalizeLegacySchoolType(
			getMetadataString(unsafeMetadata, "schoolType"),
		);

		return {
			clerkId: clerkUser.id,
			email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
			...(name ? { name } : {}),
			phone:
				getMetadataString(unsafeMetadata, "phone") ??
				clerkUser.primaryPhoneNumber?.phoneNumber,
			birthDate: getMetadataString(unsafeMetadata, "birthDate"),
			grade: getMetadataString(unsafeMetadata, "grade"),
			schoolType,
			state: getMetadataString(unsafeMetadata, "state"),
			avatarUrl: clerkUser.imageUrl,
			validationStudentCode: getMetadataString(
				unsafeMetadata,
				"validationStudentCode",
			),
			onboardingRegistrationAttemptId: getMetadataString(
				unsafeMetadata,
				"onboardingRegistrationAttemptId",
			),
		};
	}, [clerkUser]);

	useEffect(() => {
		void onboardingRestoreAttempt;
		if (!user) return;

		let cancelled = false;
		void (async () => {
			try {
				const accountFingerprint = await getOnboardingAccountFingerprint(
					user.email,
				);
				const forcedRecovery = verificationRecoveryRef.current;
				if (
					forcedRecovery?.clerkUserId === user.clerkId &&
					forcedRecovery.accountFingerprint === accountFingerprint
				) {
					if (!cancelled) {
						setPostAuthSyncFailure("restore");
						setOnboardingCompletion({
							clerkUserId: user.clerkId,
							accountFingerprint,
							result: { status: "recovery_required", reason: "invalid" },
						});
					}
					return;
				}
				const result = await pendingOnboardingSyncOutbox.resume({
					clerkUserId: user.clerkId,
					accountFingerprint,
					registrationAttemptId: user.onboardingRegistrationAttemptId,
				});
				if (!cancelled) {
					setPostAuthSyncFailure((current) =>
						current === "restore" ? null : current,
					);
					setOnboardingCompletion({
						clerkUserId: user.clerkId,
						accountFingerprint,
						result,
					});
				}
			} catch (error) {
				logDiagnosticError(
					"Failed to restore pending onboarding sync.",
					error,
					{ source: "auth.onboarding.outbox.restore", level: "warn" },
				);
				if (!cancelled) {
					setPostAuthSyncFailure("restore");
					setOnboardingCompletion({
						clerkUserId: user.clerkId,
						accountFingerprint: null,
						result: { status: "storage_error" },
					});
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [onboardingRestoreAttempt, user]);

	useEffect(() => {
		if (!clerkUser) return;
		const rawSchoolType = getMetadataString(
			clerkUser.unsafeMetadata ?? {},
			"schoolType",
		);
		if (!rawSchoolType) return;
		const schoolType = normalizeLegacySchoolType(rawSchoolType);
		if (schoolType === rawSchoolType) return;

		void clerkUser
			.updateMetadata({
				unsafeMetadata: { schoolType: schoolType ?? null },
			})
			.catch(() => {
				logDiagnosticError(
					"Failed to sanitize legacy school type metadata.",
					new Error("Clerk metadata cleanup failed."),
					{ source: "auth.sanitizeSchoolType", level: "warn" },
				);
			});
	}, [clerkUser]);

	const activateSession = useCallback(
		async (sessionId: string | null) => {
			if (!sessionId) {
				throw new Error("Anmeldung fehlgeschlagen.");
			}
			await clerk.setActive({ session: sessionId });
			setPendingVerification(null);
			setPendingLoginStage(null);
			setPendingProfile(null);
		},
		[clerk],
	);

	useEffect(() => {
		void profileSyncAttempt;
		if (!user || !isConvexAuthenticated) return;

		let cancelled = false;

		const profile = {
			...definedProfileFields({
				name: pendingProfile?.name ?? user.name,
				phone: pendingProfile?.phone ?? user.phone,
				birthDate: pendingProfile?.birthDate ?? user.birthDate,
				grade: pendingProfile?.grade ?? user.grade,
				schoolType: pendingProfile?.schoolType ?? user.schoolType,
				state: pendingProfile?.state ?? user.state,
			}),
			...(user.avatarUrl !== undefined ? { avatarUrl: user.avatarUrl } : {}),
			...(user.validationStudentCode !== undefined
				? { validationStudentCode: user.validationStudentCode }
				: {}),
		};

		void (async () => {
			setIsProfileSyncing(true);
			setPostAuthSyncFailure((current) =>
				clearOwnedPostAuthSyncFailure(current, "profile"),
			);
			setSyncedClerkUserId(null);
			try {
				const result = await runWithAuthSettleRetries(() =>
					syncCurrentUser(profile),
				);
				if (result.ok) {
					if (!cancelled) setSyncedClerkUserId(user.clerkId);
					return;
				}
				logDiagnosticError(
					"Failed to sync authenticated user profile.",
					result.lastError,
					{ source: "auth.syncCurrentUser", level: "warn" },
				);
				if (result.lastError !== result.firstError) {
					logDiagnosticError(
						"Initial user profile sync error.",
						result.firstError,
						{
							source: "auth.syncCurrentUser.initial",
							level: "warn",
						},
					);
				}
				if (!cancelled) setPostAuthSyncFailure("profile");
			} finally {
				if (!cancelled) setIsProfileSyncing(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [
		isConvexAuthenticated,
		pendingProfile,
		profileSyncAttempt,
		syncCurrentUser,
		user,
	]);

	const captureOnboardingCompleted = useCallback(async () => {
		if (!isPostHogConfigured || !user) return;

		const localDayKey = getDayKey(new Date());
		let validationStudentCode = user.validationStudentCode ?? null;
		const activityResult = await runWithAuthSettleRetries(() =>
			markValidationActivity({ localDayKey }),
		);
		if (!activityResult.ok) {
			logDiagnosticError(
				"Failed to mark onboarding validation activity.",
				activityResult.lastError,
				{
					source: "auth.onboarding.analytics.markActivity",
					level: "warn",
				},
			);
			if (activityResult.lastError !== activityResult.firstError) {
				logDiagnosticError(
					"Initial onboarding validation activity error.",
					activityResult.firstError,
					{
						source: "auth.onboarding.analytics.markActivity.initial",
						level: "warn",
					},
				);
			}
			return;
		}
		validationStudentCode =
			activityResult.value.validationStudentCode ?? validationStudentCode;

		createValidationAnalytics(posthog, {
			distinctId: user.clerkId,
			sharedContext: { validationStudentCode },
		}).capture("onboarding_completed", {
			local_day_key: localDayKey,
			onboarding_version: 3,
		});
	}, [markValidationActivity, posthog, user]);

	useEffect(() => {
		void answersSyncAttempt;
		if (
			!user ||
			!isConvexAuthenticated ||
			syncedClerkUserId !== user.clerkId ||
			onboardingCompletion.clerkUserId !== user.clerkId ||
			!onboardingCompletion.accountFingerprint ||
			onboardingCompletion.result.status !== "pending"
		)
			return;

		let cancelled = false;
		const identity = {
			clerkUserId: user.clerkId,
			accountFingerprint: onboardingCompletion.accountFingerprint,
		};

		void (async () => {
			setIsOnboardingAnswersSyncing(true);
			setPostAuthSyncFailure((current) =>
				clearOwnedPostAuthSyncFailure(current, "answers"),
			);
			try {
				const result = await runWithAuthSettleRetries(() =>
					syncPendingOnboardingAnswers({
						outbox: pendingOnboardingSyncOutbox,
						identity,
						sync: (answers) => saveOnboardingAnswers({ answers }),
					}),
				);
				if (result.ok) {
					if (!cancelled) {
						const transition = getPendingOnboardingSyncTransition(result.value);
						if (transition.shouldFinalize) {
							void captureOnboardingCompleted();
							clearAnswers();
						}
						setOnboardingCompletion({
							clerkUserId: user.clerkId,
							accountFingerprint: identity.accountFingerprint,
							result: transition.result,
						});
					}
					return;
				}
				logDiagnosticError(
					"Failed to save onboarding answers.",
					result.lastError,
					{
						source: "auth.saveOnboardingAnswers",
						level: "warn",
					},
				);
				if (result.lastError !== result.firstError) {
					logDiagnosticError(
						"Initial onboarding answer save error.",
						result.firstError,
						{
							source: "auth.saveOnboardingAnswers.initial",
							level: "warn",
						},
					);
				}
				if (!cancelled) setPostAuthSyncFailure("answers");
			} finally {
				if (!cancelled) setIsOnboardingAnswersSyncing(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [
		clearAnswers,
		answersSyncAttempt,
		captureOnboardingCompleted,
		isConvexAuthenticated,
		onboardingCompletion,
		saveOnboardingAnswers,
		syncedClerkUserId,
		user,
	]);

	const withSubmitting = async <TResult,>(task: () => Promise<TResult>) => {
		setIsSubmitting(true);
		try {
			return await task();
		} finally {
			setIsSubmitting(false);
		}
	};

	const completeOnboardingHandoff = useCallback(async () => {
		if (
			!user ||
			!clerkUser ||
			clerkUser.id !== user.clerkId ||
			onboardingCompletion.clerkUserId !== user.clerkId ||
			!onboardingCompletion.accountFingerprint ||
			onboardingCompletion.result.status !== "ready_for_trial"
		) {
			return false;
		}
		const accountFingerprint = onboardingCompletion.accountFingerprint;
		try {
			await finalizePendingOnboardingCompletion({
				clearRegistrationAttempt: async () => {
					if (!user.onboardingRegistrationAttemptId) return;
					await clerkUser.updateMetadata({
						unsafeMetadata: { onboardingRegistrationAttemptId: null },
					});
				},
				acknowledgeCompletion: () =>
					pendingOnboardingSyncOutbox.acknowledgeCompletion({
						clerkUserId: user.clerkId,
						accountFingerprint,
					}),
			});
			setPostAuthSyncFailure((current) =>
				clearOwnedPostAuthSyncFailure(current, "completion"),
			);
			setOnboardingCompletion({
				clerkUserId: user.clerkId,
				accountFingerprint,
				result: { status: "none" },
			});
			return true;
		} catch (error) {
			logDiagnosticError(
				"Failed to acknowledge completed onboarding sync.",
				error,
				{ source: "auth.onboarding.outbox.complete", level: "warn" },
			);
			setPostAuthSyncFailure("completion");
			return false;
		}
	}, [clerkUser, onboardingCompletion, user]);

	const retryPostAuthSync = useCallback(() => {
		const failedBoundary = postAuthSyncFailure;
		setPostAuthSyncFailure(null);
		retryPostAuthSyncFailure(failedBoundary, {
			profile: retryProfileSync,
			answers: retryAnswersSync,
			completion: () => {
				void completeOnboardingHandoff();
			},
			restore: () => {
				if (!user) return;
				setOnboardingCompletion({
					clerkUserId: user.clerkId,
					accountFingerprint: null,
					result: { status: "loading" },
				});
				retryOnboardingRestore();
			},
		});
	}, [completeOnboardingHandoff, postAuthSyncFailure, user]);

	const login = async (input: LoginInput): Promise<AuthFlowResult> =>
		withSubmitting(async () => {
			if (!clerk.client) {
				throw new Error("Authentifizierung ist noch nicht bereit.");
			}

			const normalizedEmail = input.email.trim().toLowerCase();

			try {
				const signIn = await clerk.client.signIn.create({
					strategy: "password",
					identifier: normalizedEmail,
					password: input.password,
				});

				if (signIn.status === "complete") {
					await activateSession(signIn.createdSessionId);
					return { status: "complete" };
				}

				if (
					signIn.status === "needs_second_factor" ||
					signIn.status === "needs_client_trust"
				) {
					const emailAddressId = findEmailAddressId(
						signIn.supportedSecondFactors,
					);
					if (!emailAddressId) {
						throw new Error(
							`Diese Anmeldung erfordert eine zusätzliche Sicherheitsprüfung: ${getAuthFactorList(
								signIn.supportedSecondFactors,
							)}. Die App unterstützt aktuell E-Mail-Code für diesen Schritt.`,
						);
					}
					await signIn.prepareSecondFactor({
						strategy: "email_code",
						emailAddressId,
					});
					setPendingVerification({
						mode: "login",
						email: normalizedEmail,
					});
					setPendingLoginStage("second_factor");
					return {
						status: "needs_verification",
						message:
							signIn.status === "needs_client_trust"
								? "Neues Gerät erkannt. Bitte gib den Sicherheitscode aus deiner E-Mail ein."
								: "Bitte gib den Code aus deiner E-Mail ein.",
					};
				}

				if (signIn.status === "needs_first_factor") {
					const emailAddressId = findEmailAddressId(
						signIn.supportedFirstFactors,
					);
					if (!emailAddressId) {
						throw new Error(
							`Diese Anmeldung erfordert eine andere Anmeldemethode: ${getAuthFactorList(
								signIn.supportedFirstFactors,
							)}. Die App unterstützt aktuell E-Mail-Code als zusätzlichen Schritt.`,
						);
					}

					await signIn.prepareFirstFactor({
						strategy: "email_code",
						emailAddressId,
					});
					setPendingVerification({
						mode: "login",
						email: normalizedEmail,
					});
					setPendingLoginStage("first_factor");
					return {
						status: "needs_verification",
						message: "Wir haben dir einen Anmeldecode per E-Mail gesendet.",
					};
				}

				if (signIn.status === "needs_identifier") {
					throw new Error("Bitte gib deine E-Mail-Adresse ein.");
				}

				if (signIn.status === "needs_new_password") {
					throw new Error(
						"Für dieses Konto muss zuerst ein neues Passwort gesetzt werden.",
					);
				}

				throw new Error(
					`Anmeldung konnte nicht abgeschlossen werden. Unerwarteter Clerk-Status: ${
						signIn.status ?? "unbekannt"
					}.`,
				);
			} catch (error) {
				throw new Error(
					getClerkErrorMessage(error, "Anmeldung fehlgeschlagen."),
				);
			}
		});

	const startRegistrationWithEmail = async (email: string): Promise<void> =>
		withSubmitting(async () => {
			if (!clerk.client) {
				throw new Error("Authentifizierung ist noch nicht bereit.");
			}

			try {
				await clerk.client.signUp.upsert({
					emailAddress: email.trim().toLowerCase(),
				});
			} catch (error) {
				throw new Error(
					getClerkErrorMessage(
						error,
						"E-Mail-Adresse konnte nicht geprüft werden. Bitte versuche es erneut.",
					),
				);
			}
		});

	const stageOnboardingRecovery = async (
		answers: PendingOnboardingSyncAnswers,
	) => {
		if (!clerk.client) {
			throw new Error("Authentifizierung ist noch nicht bereit.");
		}
		const signUp = clerk.client.signUp;
		if (!signUp.id || !signUp.emailAddress) {
			throw new Error(
				"Die Registrierung konnte nicht sicher vorbereitet werden. Bitte prüfe deine E-Mail-Adresse erneut.",
			);
		}
		const accountFingerprint = await getOnboardingAccountFingerprint(
			signUp.emailAddress,
		);
		try {
			await pendingOnboardingSyncOutbox.stage({
				registrationAttemptId: signUp.id,
				accountFingerprint,
				answers,
			});
			await pendingOnboardingSyncOutbox.ensureStaged({
				registrationAttemptId: signUp.id,
				accountFingerprint,
			});
		} catch (error) {
			logDiagnosticError("Failed to stage pending onboarding sync.", error, {
				source: "auth.onboarding.outbox.stage",
				level: "warn",
			});
			throw new Error(
				"Deine Lernzeiten konnten nicht sicher für die Kontoerstellung vorbereitet werden. Bitte versuche es erneut.",
			);
		}
	};

	const replaceOnboardingRecoveryAnswers = async (
		answers: PendingOnboardingSyncAnswers,
	) => {
		if (
			!user ||
			onboardingCompletion.clerkUserId !== user.clerkId ||
			!onboardingCompletion.accountFingerprint ||
			onboardingCompletion.result.status !== "recovery_required"
		) {
			throw new Error("Es gibt keine offene Onboarding-Wiederherstellung.");
		}
		const ownedBoundary = getOnboardingRecoveryOwnedBoundary(
			verificationRecoveryRef.current?.clerkUserId === user.clerkId,
		);
		try {
			await pendingOnboardingSyncOutbox.stageForUser({
				registrationAttemptId: "recovery",
				clerkUserId: user.clerkId,
				accountFingerprint: onboardingCompletion.accountFingerprint,
				answers,
			});
		} catch (error) {
			logDiagnosticError(
				"Failed to replace onboarding recovery answers.",
				error,
				{ source: "auth.onboarding.outbox.recovery", level: "warn" },
			);
			setPostAuthSyncFailure(ownedBoundary);
			throw new Error(
				"Deine Lernzeiten konnten nicht sicher gespeichert werden. Bitte versuche es erneut.",
			);
		}
		if (ownedBoundary === "restore") verificationRecoveryRef.current = null;
		setPostAuthSyncFailure((current) =>
			clearOwnedPostAuthSyncFailure(current, ownedBoundary),
		);
		setOnboardingCompletion({
			clerkUserId: user.clerkId,
			accountFingerprint: onboardingCompletion.accountFingerprint,
			result: { status: "pending", answers },
		});
	};

	const handleOnboardingBindingFailure = (
		error: unknown,
		identity: {
			registrationAttemptId: string;
			clerkUserId: string;
			accountFingerprint: string;
		},
	) => {
		logDiagnosticError("Failed to bind verified onboarding recovery.", error, {
			source: "auth.onboarding.outbox.bind",
			level: "warn",
		});
		setPostAuthSyncFailure("restore");
		if (error instanceof PendingOnboardingSyncError) {
			verificationRecoveryRef.current = identity;
			setOnboardingCompletion({
				clerkUserId: identity.clerkUserId,
				accountFingerprint: identity.accountFingerprint,
				result: { status: "recovery_required", reason: "invalid" },
			});
			return;
		}
		setOnboardingCompletion({
			clerkUserId: identity.clerkUserId,
			accountFingerprint: identity.accountFingerprint,
			result: { status: "storage_error" },
		});
	};

	const handleOnboardingIdentityFailure = (
		error: unknown,
		candidate: {
			registrationAttemptId: string | null | undefined;
			clerkUserId: string | null | undefined;
		},
	) => {
		logDiagnosticError(
			"Failed to resolve verified onboarding recovery identity.",
			error,
			{ source: "auth.onboarding.outbox.identity", level: "warn" },
		);
		setPostAuthSyncFailure("restore");
		setOnboardingCompletion({
			clerkUserId: candidate.clerkUserId ?? null,
			accountFingerprint: null,
			result:
				error instanceof IncompleteRegistrationIdentityError
					? { status: "recovery_required", reason: "invalid" }
					: { status: "storage_error" },
		});
	};

	const register = async (input: RegisterInput): Promise<AuthFlowResult> =>
		withSubmitting(async () => {
			if (!clerk.client) {
				throw new Error("Authentifizierung ist noch nicht bereit.");
			}

			const { profile, signUp: signUpParameters } =
				prepareClerkRegistration(input);

			try {
				const registrationAttemptId = clerk.client.signUp.id;
				if (!registrationAttemptId) {
					throw new PendingOnboardingSyncError(
						"payload_unavailable",
						"Registrierungsversuch konnte nicht zugeordnet werden.",
					);
				}
				const signUpParametersWithRecovery = {
					...signUpParameters,
					unsafeMetadata: {
						...signUpParameters.unsafeMetadata,
						onboardingRegistrationAttemptId: registrationAttemptId,
					},
				};
				const signUp = await clerk.client.signUp.upsert(
					signUpParametersWithRecovery,
				);
				if (!signUp.id) {
					throw new PendingOnboardingSyncError(
						"payload_unavailable",
						"Registrierungsversuch konnte nicht zugeordnet werden.",
					);
				}
				const accountFingerprint = await getOnboardingAccountFingerprint(
					input.email,
				);
				await pendingOnboardingSyncOutbox.ensureStaged({
					registrationAttemptId: signUp.id,
					accountFingerprint,
				});

				setPendingProfile(profile);

				if (signUp.status === "complete") {
					await finalizeCompletedRegistration({
						candidate: {
							registrationAttemptId: signUp.id,
							clerkUserId: signUp.createdUserId,
							emailAddress: signUp.emailAddress ?? input.email,
							sessionId: signUp.createdSessionId,
						},
						getAccountFingerprint: async () => accountFingerprint,
						bindToUser: (identity) =>
							pendingOnboardingSyncOutbox.bindToUser(identity),
						activateSession,
						onBindingFailure: handleOnboardingBindingFailure,
						onIdentityFailure: handleOnboardingIdentityFailure,
					});
					return { status: "complete" };
				}

				await signUp.prepareEmailAddressVerification({
					strategy: "email_code",
				});
				setPendingVerification({
					mode: "register",
					email: input.email.trim().toLowerCase(),
					registrationAttemptId: signUp.id,
				});

				return {
					status: "needs_verification",
					message: "Wir haben dir einen Bestätigungscode per E-Mail gesendet.",
				};
			} catch (error) {
				if (error instanceof PendingOnboardingSyncError) {
					logDiagnosticError(
						"Registration stopped because onboarding recovery was unavailable.",
						error,
						{ source: "auth.onboarding.outbox.registration", level: "warn" },
					);
					throw new Error(
						"Deine Lernzeiten konnten nicht sicher mit deinem Konto verknüpft werden. Bitte versuche es erneut.",
					);
				}
				throw new Error(
					getClerkErrorMessage(error, "Registrierung fehlgeschlagen."),
				);
			}
		});

	const persistProfileToConvex = async (profile: UpdateProfileInput) => {
		if (!isConvexAuthenticated) return;
		await updateConvexProfile({
			email: profile.email,
			name: profile.name,
			birthDate: profile.birthDate,
			grade: profile.grade,
			schoolType: profile.schoolType,
			state: profile.state,
		});
	};

	const updateProfile = async (
		input: UpdateProfileInput,
	): Promise<ProfileUpdateResult> =>
		withSubmitting(async () => {
			if (!clerkUser) {
				throw new Error("Du bist nicht angemeldet.");
			}

			const normalizedProfile = {
				email: input.email.trim().toLowerCase(),
				name: input.name.trim(),
				birthDate: input.birthDate.trim(),
				grade: input.grade.trim(),
				schoolType: normalizeOptionalSchoolTypeInput(input.schoolType),
				state: input.state.trim(),
			};
			if (
				normalizedProfile.grade &&
				!isSupportedGrade(normalizedProfile.grade)
			) {
				throw new Error("Bitte wähle eine gültige Klassenstufe aus.");
			}
			const { firstName, lastName } = splitName(normalizedProfile.name);
			const unsafeMetadata: Record<string, unknown> = {
				...(clerkUser.unsafeMetadata ?? {}),
				birthDate: normalizedProfile.birthDate,
				grade: normalizedProfile.grade,
				state: normalizedProfile.state,
			};
			delete unsafeMetadata.schoolType;
			if (normalizedProfile.schoolType) {
				unsafeMetadata.schoolType = normalizedProfile.schoolType;
			}

			try {
				await clerkUser.update({
					firstName,
					lastName,
					unsafeMetadata,
				});

				const currentEmail =
					clerkUser.primaryEmailAddress?.emailAddress.trim().toLowerCase() ??
					"";
				if (
					normalizedProfile.email &&
					normalizedProfile.email !== currentEmail
				) {
					const existingEmail = clerkUser.emailAddresses.find(
						(emailAddress) =>
							emailAddress.emailAddress.trim().toLowerCase() ===
							normalizedProfile.email,
					);
					const emailAddress =
						existingEmail ??
						(await clerkUser.createEmailAddress({
							email: normalizedProfile.email,
						}));

					if (emailAddress.verification?.status !== "verified") {
						await emailAddress.prepareVerification({ strategy: "email_code" });
						setPendingProfileEmail({
							email: normalizedProfile.email,
							emailAddress,
							profile: normalizedProfile,
						});
						return {
							status: "needs_email_verification",
							message:
								"Wir haben dir einen Code an die neue E-Mail-Adresse gesendet.",
						};
					}

					await clerkUser.update({
						primaryEmailAddressId: emailAddress.id,
					});
				}

				await persistProfileToConvex(normalizedProfile);
				setPendingProfile({
					name: normalizedProfile.name,
					birthDate: normalizedProfile.birthDate,
					grade: normalizedProfile.grade,
					schoolType: normalizedProfile.schoolType,
					state: normalizedProfile.state,
				});
				return { status: "complete" };
			} catch (error) {
				throw new Error(
					getClerkErrorMessage(
						error,
						"Profil konnte nicht gespeichert werden.",
					),
				);
			}
		});

	const verifyProfileEmailCode = async (code: string) =>
		withSubmitting(async () => {
			if (!pendingProfileEmail || !clerkUser) {
				throw new Error("Es gibt keine offene E-Mail-Bestätigung.");
			}

			try {
				const verifiedEmail =
					await pendingProfileEmail.emailAddress.attemptVerification({
						code: code.trim(),
					});
				await clerkUser.update({
					primaryEmailAddressId: verifiedEmail.id,
				});
				await persistProfileToConvex(pendingProfileEmail.profile);
				setPendingProfile({
					name: pendingProfileEmail.profile.name,
					birthDate: pendingProfileEmail.profile.birthDate,
					grade: pendingProfileEmail.profile.grade,
					schoolType: pendingProfileEmail.profile.schoolType,
					state: pendingProfileEmail.profile.state,
				});
				setPendingProfileEmail(null);
			} catch (error) {
				throw new Error(
					getClerkErrorMessage(error, "E-Mail konnte nicht bestätigt werden."),
				);
			}
		});

	const verifyEmailCode = async (code: string): Promise<AuthFlowResult> =>
		withSubmitting(async () => {
			if (!pendingVerification || !clerk.client) {
				throw new Error("Es gibt keine offene E-Mail-Bestätigung.");
			}

			try {
				if (pendingVerification.mode === "register") {
					const signUp =
						await clerk.client.signUp.attemptEmailAddressVerification({
							code: code.trim(),
						});
					if (signUp.status !== "complete") {
						throw new Error("Der Code konnte nicht bestätigt werden.");
					}
					await finalizeCompletedRegistration({
						candidate: {
							registrationAttemptId:
								signUp.id ?? pendingVerification.registrationAttemptId,
							clerkUserId: signUp.createdUserId,
							emailAddress: signUp.emailAddress ?? pendingVerification.email,
							sessionId: signUp.createdSessionId,
						},
						getAccountFingerprint: getOnboardingAccountFingerprint,
						bindToUser: (identity) =>
							pendingOnboardingSyncOutbox.bindToUser(identity),
						activateSession,
						onBindingFailure: handleOnboardingBindingFailure,
						onIdentityFailure: handleOnboardingIdentityFailure,
					});
					return { status: "complete" };
				}

				const signIn =
					pendingLoginStage === "second_factor"
						? await clerk.client.signIn.attemptSecondFactor({
								strategy: "email_code",
								code: code.trim(),
							})
						: await clerk.client.signIn.attemptFirstFactor({
								strategy: "email_code",
								code: code.trim(),
							});

				if (signIn.status !== "complete") {
					throw new Error("Der Code konnte nicht bestätigt werden.");
				}
				await activateSession(signIn.createdSessionId);
				return { status: "complete" };
			} catch (error) {
				throw new Error(
					getClerkErrorMessage(error, "Bestätigung fehlgeschlagen."),
				);
			}
		});

	const resendVerification = async () =>
		withSubmitting(async () => {
			if (!pendingVerification || !clerk.client) {
				throw new Error("Es gibt keine offene E-Mail-Bestätigung.");
			}

			if (pendingVerification.mode === "register") {
				await clerk.client.signUp.prepareEmailAddressVerification({
					strategy: "email_code",
				});
				return;
			}

			if (pendingLoginStage === "second_factor") {
				const emailAddressId = findEmailAddressId(
					clerk.client.signIn.supportedSecondFactors,
				);
				if (!emailAddressId) {
					throw new Error("Code konnte nicht gesendet werden.");
				}
				await clerk.client.signIn.prepareSecondFactor({
					strategy: "email_code",
					emailAddressId,
				});
				return;
			}

			const emailAddressId = findEmailAddressId(
				clerk.client.signIn.supportedFirstFactors,
			);
			if (!emailAddressId)
				throw new Error("Code konnte nicht gesendet werden.");
			await clerk.client.signIn.prepareFirstFactor({
				strategy: "email_code",
				emailAddressId,
			});
		});

	const getPasswordResetSignIn = () => {
		if (!passwordResetSignIn) {
			throw new Error("Authentifizierung ist noch nicht bereit.");
		}
		return passwordResetSignIn;
	};

	const startPasswordReset = async (email: string) =>
		withSubmitting(async () => {
			try {
				setPendingVerification(null);
				setPendingLoginStage(null);
				const result = await beginPasswordReset(
					getPasswordResetSignIn(),
					email,
				);
				passwordResetHasRemoteAttemptRef.current =
					result.status === "code_sent";
			} catch (error) {
				passwordResetHasRemoteAttemptRef.current = false;
				logDiagnosticError("Failed to start password recovery.", error, {
					source: "auth.passwordReset.start",
					level: "warn",
				});
				throw new Error(
					"Der Zurücksetzungscode konnte nicht gesendet werden. Bitte versuche es später erneut.",
				);
			}
		});

	const verifyPasswordResetCode = async (code: string) =>
		withSubmitting(async () => {
			try {
				await verifyPasswordResetAttempt(getPasswordResetSignIn(), code);
			} catch (error) {
				throw new Error(
					getClerkErrorMessage(
						error,
						"Der Code konnte nicht bestätigt werden.",
					),
				);
			}
		});

	const completePasswordReset = async (password: string) =>
		withSubmitting(async () => {
			try {
				return await submitPasswordReset(getPasswordResetSignIn(), password);
			} catch (error) {
				throw new Error(
					getClerkErrorMessage(
						error,
						"Das Passwort konnte nicht zurückgesetzt werden.",
					),
				);
			}
		});

	const verifyPasswordResetSecondFactor = async (code: string) =>
		withSubmitting(async () => {
			try {
				await verifyPasswordResetSecondFactorAttempt(
					getPasswordResetSignIn(),
					code,
				);
			} catch (error) {
				throw new Error(
					getClerkErrorMessage(
						error,
						"Die Sicherheitsprüfung konnte nicht abgeschlossen werden.",
					),
				);
			}
		});

	const resendPasswordResetCode = async (stage: PasswordResetCodeStage) =>
		withSubmitting(async () => {
			try {
				await resendPasswordResetAttempt(
					getPasswordResetSignIn(),
					stage,
					passwordResetHasRemoteAttemptRef.current,
				);
			} catch (error) {
				throw new Error(
					getClerkErrorMessage(
						error,
						"Code konnte nicht erneut gesendet werden.",
					),
				);
			}
		});

	const cancelPasswordReset = async () => {
		try {
			if (!passwordResetSignIn) return;
			await cancelPasswordResetAttempt(passwordResetSignIn);
		} finally {
			passwordResetHasRemoteAttemptRef.current = false;
		}
	};

	const changePassword = async (input: PasswordChangeInput) =>
		withSubmitting(async () => {
			if (!clerkUser || !clerk.session) {
				throw new Error(
					"Du musst angemeldet sein, um dein Passwort zu ändern.",
				);
			}

			try {
				await reverifyPasswordFactor(
					clerk.session as PasswordReverificationSession,
					input.currentPassword,
				);
				await updateAccountPassword(clerkUser, input);
			} catch (error) {
				throw new Error(getPasswordChangeErrorMessage(error));
			}
		});

	const completeForcedPasswordReset = async (password: string) =>
		withSubmitting(async () => {
			const taskUser = clerk.session?.user ?? clerkUser;
			if (!taskUser) {
				throw new Error(
					"Die Passwort-Aufgabe ist nicht mehr verfügbar. Bitte melde dich erneut an.",
				);
			}

			try {
				await submitForcedPasswordReset(
					taskUser as ForcedPasswordResetUser,
					password,
				);
			} catch (error) {
				throw new Error(
					getClerkErrorMessage(
						error,
						"Das neue Passwort konnte nicht gespeichert werden.",
					),
				);
			}
		});

	const logout = async () => {
		await signOutAndResetState(
			() => clerk.signOut(),
			() => {
				setPendingVerification(null);
				setPendingLoginStage(null);
				setPendingProfile(null);
				setPendingProfileEmail(null);
				setSyncedClerkUserId(null);
				setPostAuthSyncFailure(null);
				setOnboardingCompletion({
					clerkUserId: null,
					accountFingerprint: null,
					result: { status: "none" },
				});
				verificationRecoveryRef.current = null;
				passwordResetHasRemoteAttemptRef.current = false;
				clearAnswers();
			},
		);
	};

	const isSessionLoading = !clerk.loaded || !isUserLoaded;
	const isLoading = isSessionLoading || isSubmitting;
	const pendingSessionTask = clerk.session?.currentTask?.key ?? null;
	const onboardingCompletionStatus = !user
		? "none"
		: onboardingCompletion.clerkUserId === user.clerkId
			? onboardingCompletion.result.status
			: "loading";
	const postAuthSyncError = postAuthSyncFailure
		? POST_AUTH_SYNC_ERROR_MESSAGES[postAuthSyncFailure]
		: null;

	return (
		<AuthSessionContext.Provider
			value={{
				user,
				isSessionLoading,
				isConvexAuthenticated,
				isConvexUserSynced:
					Boolean(user) && syncedClerkUserId === user?.clerkId,
				isPostAuthSyncing:
					Boolean(user) && (isProfileSyncing || isOnboardingAnswersSyncing),
				postAuthSyncError,
				retryPostAuthSync,
				onboardingCompletionStatus,
				completeOnboardingHandoff,
				pendingSessionTask,
			}}
		>
			<AuthFlowContext.Provider
				value={{
					isLoading,
					pendingVerification,
					login,
					startRegistrationWithEmail,
					register,
					stageOnboardingRecovery,
					replaceOnboardingRecoveryAnswers,
					verifyEmailCode,
					resendVerification,
					startPasswordReset,
					verifyPasswordResetCode,
					completePasswordReset,
					verifyPasswordResetSecondFactor,
					resendPasswordResetCode,
					cancelPasswordReset,
				}}
			>
				<AccountActionsContext.Provider
					value={{
						isLoading,
						updateProfile,
						verifyProfileEmailCode,
						changePassword,
						completeForcedPasswordReset,
						logout,
					}}
				>
					{children}
				</AccountActionsContext.Provider>
			</AuthFlowContext.Provider>
		</AuthSessionContext.Provider>
	);
};

export const useAuthSession = () => {
	const context = useContext(AuthSessionContext);
	if (!context) {
		throw new Error("useAuthSession must be used within an AuthProvider");
	}
	return context;
};

export const useAuthFlow = () => {
	const context = useContext(AuthFlowContext);
	if (!context) {
		throw new Error("useAuthFlow must be used within an AuthProvider");
	}
	return context;
};

export const useAccountActions = () => {
	const context = useContext(AccountActionsContext);
	if (!context) {
		throw new Error("useAccountActions must be used within an AuthProvider");
	}
	return context;
};
