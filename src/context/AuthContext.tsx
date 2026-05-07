import { isClerkAPIResponseError, useClerk, useUser } from "@clerk/expo";
import { useConvexAuth, useMutation } from "convex/react";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { api } from "#convex/_generated/api";
import { useOnboarding } from "~/context/OnboardingContext";

type LoginInput = {
	email: string;
	password: string;
};

type RegisterInput = {
	email: string;
	password: string;
	name?: string;
	phone?: string;
	birthDate?: string;
};

type AuthUser = {
	clerkId: string;
	email: string;
	name?: string;
	phone?: string;
	birthDate?: string;
	avatarUrl?: string;
};

type AuthFlowResult =
	| { status: "complete" }
	| { status: "needs_verification"; message: string };

type PendingVerification = {
	mode: "login" | "register";
	email: string;
};

type PendingLoginStage = "first_factor" | "second_factor";

interface AuthContextType {
	user: AuthUser | null;
	isLoading: boolean;
	isSessionLoading: boolean;
	pendingVerification: PendingVerification | null;
	login: (input: LoginInput) => Promise<AuthFlowResult>;
	register: (input: RegisterInput) => Promise<AuthFlowResult>;
	verifyEmailCode: (code: string) => Promise<AuthFlowResult>;
	resendVerification: () => Promise<void>;
	logout: () => Promise<void>;
}

type RegisterProfile = {
	name?: string;
	phone?: string;
	birthDate?: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getMetadataString = (metadata: Record<string, unknown>, key: string) =>
	typeof metadata[key] === "string" ? metadata[key] : undefined;

const splitName = (name?: string) => {
	const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
	const [firstName, ...rest] = parts;
	return {
		firstName,
		lastName: rest.length > 0 ? rest.join(" ") : undefined,
	};
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

const definedProfileFields = (profile: RegisterProfile) => ({
	...(profile.name !== undefined ? { name: profile.name } : {}),
	...(profile.phone !== undefined ? { phone: profile.phone } : {}),
	...(profile.birthDate !== undefined ? { birthDate: profile.birthDate } : {}),
});

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

const wait = (milliseconds: number) =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const clerk = useClerk();
	const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const syncCurrentUser = useMutation(api.users.syncCurrentUser);
	const saveOnboardingAnswers = useMutation(api.users.saveOnboardingAnswers);
	const {
		answers: onboardingAnswers,
		clearAnswers,
		hasAnswers,
	} = useOnboarding();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [pendingVerification, setPendingVerification] =
		useState<PendingVerification | null>(null);
	const [pendingLoginStage, setPendingLoginStage] =
		useState<PendingLoginStage | null>(null);
	const [pendingProfile, setPendingProfile] = useState<RegisterProfile | null>(
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

		return {
			clerkId: clerkUser.id,
			email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
			...(name ? { name } : {}),
			phone:
				getMetadataString(unsafeMetadata, "phone") ??
				clerkUser.primaryPhoneNumber?.phoneNumber,
			birthDate: getMetadataString(unsafeMetadata, "birthDate"),
			avatarUrl: clerkUser.imageUrl,
		};
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
		if (!user || !isConvexAuthenticated) return;

		const profile = {
			...definedProfileFields({
				name: pendingProfile?.name ?? user.name,
				phone: pendingProfile?.phone ?? user.phone,
				birthDate: pendingProfile?.birthDate ?? user.birthDate,
			}),
			...(user.avatarUrl !== undefined ? { avatarUrl: user.avatarUrl } : {}),
		};

		void syncCurrentUser(profile).catch(async (error: unknown) => {
			// Convex auth can lag behind Clerk briefly during session activation.
			await wait(750);
			try {
				await syncCurrentUser(profile);
			} catch (retryError) {
				console.warn("Failed to sync authenticated user profile.", retryError);
				if (retryError !== error) {
					console.warn("Initial user profile sync error.", error);
				}
			}
		});
	}, [isConvexAuthenticated, pendingProfile, syncCurrentUser, user]);

	useEffect(() => {
		if (!user || !isConvexAuthenticated || !hasAnswers) return;

		void saveOnboardingAnswers({
			answers: onboardingAnswers,
		})
			.then(() => {
				clearAnswers();
			})
			.catch(async (error: unknown) => {
				await wait(750);
				try {
					await saveOnboardingAnswers({
						answers: onboardingAnswers,
					});
					clearAnswers();
				} catch (retryError) {
					console.warn("Failed to save onboarding answers.", retryError);
					if (retryError !== error) {
						console.warn("Initial onboarding answer save error.", error);
					}
				}
			});
	}, [
		clearAnswers,
		hasAnswers,
		isConvexAuthenticated,
		onboardingAnswers,
		saveOnboardingAnswers,
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

	const register = async (input: RegisterInput): Promise<AuthFlowResult> =>
		withSubmitting(async () => {
			if (!clerk.client) {
				throw new Error("Authentifizierung ist noch nicht bereit.");
			}

			const profile = {
				name: input.name?.trim(),
				phone: input.phone?.trim(),
				birthDate: input.birthDate,
			};
			const { firstName, lastName } = splitName(profile.name);

			try {
				const signUp = await clerk.client.signUp.create({
					emailAddress: input.email.trim().toLowerCase(),
					password: input.password,
					firstName,
					lastName,
					unsafeMetadata: definedProfileFields(profile),
				});

				setPendingProfile(profile);

				if (signUp.status === "complete") {
					await activateSession(signUp.createdSessionId);
					return { status: "complete" };
				}

				await signUp.prepareEmailAddressVerification({
					strategy: "email_code",
				});
				setPendingVerification({
					mode: "register",
					email: input.email.trim().toLowerCase(),
				});

				return {
					status: "needs_verification",
					message: "Wir haben dir einen Bestätigungscode per E-Mail gesendet.",
				};
			} catch (error) {
				throw new Error(
					getClerkErrorMessage(error, "Registrierung fehlgeschlagen."),
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
					await activateSession(signUp.createdSessionId);
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

	const logout = async () => {
		setPendingVerification(null);
		setPendingLoginStage(null);
		setPendingProfile(null);
		await clerk.signOut();
	};

	const isSessionLoading = !clerk.loaded || !isUserLoaded;
	const isLoading = isSessionLoading || isSubmitting;

	return (
		<AuthContext.Provider
			value={{
				user,
				isLoading,
				isSessionLoading,
				pendingVerification,
				login,
				register,
				verifyEmailCode,
				resendVerification,
				logout,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) throw new Error("useAuth must be used within an AuthProvider");
	return context;
};
