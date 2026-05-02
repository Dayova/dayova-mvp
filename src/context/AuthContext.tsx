import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isClerkAPIResponseError, useClerk, useUser } from "@clerk/expo";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "#convex/_generated/api";

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

const getClerkErrorMessage = (error: unknown, fallback: string) => {
  if (isClerkAPIResponseError(error)) {
    return (
      error.errors[0]?.longMessage ?? error.errors[0]?.message ?? fallback
    );
  }
  return error instanceof Error ? error.message : fallback;
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
  const {
    isLoading: isConvexAuthLoading,
    isAuthenticated: isConvexAuthenticated,
  } = useConvexAuth();
  const syncCurrentUser = useMutation(api.users.syncCurrentUser);
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
          const emailAddressId = findEmailAddressId(signIn.supportedFirstFactors);
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
        throw new Error(getClerkErrorMessage(error, "Anmeldung fehlgeschlagen."));
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
      if (!emailAddressId) throw new Error("Code konnte nicht gesendet werden.");
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

  const isLoading =
    !clerk.loaded ||
    !isUserLoaded ||
    isSubmitting ||
    (Boolean(clerkUser) && isConvexAuthLoading);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
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
