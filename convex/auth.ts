"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { WorkOS } from "@workos-inc/node";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const fullNameFromParts = (firstName?: string | null, lastName?: string | null) => {
  const parts = [firstName?.trim(), lastName?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
};

const splitName = (name?: string) => {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return { firstName: undefined, lastName: undefined };
  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName,
    lastName: rest.length > 0 ? rest.join(" ") : undefined,
  };
};

const isValidBirthDate = (date: string) => {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(date);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const dateObj = new Date(year, month - 1, day);
  const today = new Date();
  return (
    dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day &&
    dateObj <= today
  );
};

const getWorkOS = () => {
  const apiKey = process.env.WORKOS_API_KEY;
  if (!apiKey) {
    throw new Error("WORKOS_API_KEY fehlt in den Convex Environment Variables.");
  }
  return new WorkOS(apiKey);
};

const getClientId = () => {
  const clientId = process.env.WORKOS_CLIENT_ID;
  if (!clientId) {
    throw new Error("WORKOS_CLIENT_ID fehlt in den Convex Environment Variables.");
  }
  return clientId;
};

const clientUserFromWorkosUser = (user: {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
}) => {
  const name = fullNameFromParts(user.firstName, user.lastName);
  return {
    workosId: user.id,
    email: user.email,
    ...(name !== undefined ? { name } : {}),
    ...(user.profilePictureUrl ? { avatarUrl: user.profilePictureUrl } : {}),
  };
};

const isInvalidCredentialsError = (error: unknown) => {
  const message = error instanceof Error ? error.message : `${error}`;
  return message.toLowerCase().includes("invalid credentials");
};

const loginFailure = (error: string) => ({
  ok: false as const,
  error,
});

const loginSuccess = (user: ReturnType<typeof clientUserFromWorkosUser> & {
  accessToken: string;
  refreshToken: string;
}) => ({
  ok: true as const,
  user,
});

const clientSessionFromAuthentication = (authentication: {
  user: Parameters<typeof clientUserFromWorkosUser>[0];
  accessToken: string;
  refreshToken: string;
}) => ({
  ...clientUserFromWorkosUser(authentication.user),
  accessToken: authentication.accessToken,
  refreshToken: authentication.refreshToken,
});

export const registerWithPassword = action({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    birthDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workos = getWorkOS();
    const { firstName, lastName } = splitName(args.name);
    const normalizedEmail = normalizeEmail(args.email);
    const trimmedName = (args.name ?? "").trim();
    const trimmedPhone = (args.phone ?? "").trim();
    const trimmedBirthDate = (args.birthDate ?? "").trim();

    if (trimmedName.length < 2 || !/^[A-Za-zÀ-ÿ' -]+$/.test(trimmedName)) {
      throw new Error("Bitte einen gültigen Namen eingeben.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error("Bitte eine gültige E-Mail eingeben.");
    }
    if (!/^\+?[0-9()\-.\s]{7,20}$/.test(trimmedPhone)) {
      throw new Error("Bitte eine gültige Telefonnummer eingeben.");
    }
    if (!isValidBirthDate(trimmedBirthDate)) {
      throw new Error("Bitte ein gültiges Geburtsdatum (TT.MM.JJJJ) eingeben.");
    }
    if (args.password.length < 8) {
      throw new Error("Passwort muss mindestens 8 Zeichen haben.");
    }

    const created = await workos.userManagement.createUser({
      email: normalizedEmail,
      password: args.password,
      firstName,
      lastName,
      emailVerified: true,
      metadata: {
        phone: trimmedPhone,
        birthDate: trimmedBirthDate,
      },
    });
    const authentication = await workos.userManagement.authenticateWithPassword({
      clientId: getClientId(),
      email: normalizedEmail,
      password: args.password,
    });

    await ctx.runMutation(internal.users.storeUser, {
      workosId: created.id,
      email: created.email,
      name: fullNameFromParts(created.firstName, created.lastName) ?? trimmedName,
      phone: trimmedPhone,
      birthDate: trimmedBirthDate,
      ...(created.profilePictureUrl ? { avatarUrl: created.profilePictureUrl } : {}),
    });

    return {
      ...clientUserFromWorkosUser(authentication.user),
      name: fullNameFromParts(
        authentication.user.firstName,
        authentication.user.lastName,
      ) ?? trimmedName,
      phone: trimmedPhone,
      birthDate: trimmedBirthDate,
      accessToken: authentication.accessToken,
      refreshToken: authentication.refreshToken,
    };
  },
});

export const loginWithPassword = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const workos = getWorkOS();
    const clientId = getClientId();
    const normalizedEmail = normalizeEmail(args.email);
    const password = args.password;

    if (!normalizedEmail) {
      return loginFailure("Bitte eine E-Mail-Adresse eingeben.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return loginFailure("Bitte eine gültige E-Mail eingeben.");
    }
    if (!password) {
      return loginFailure("Bitte ein Passwort eingeben.");
    }

    let authentication;
    try {
      authentication = await workos.userManagement.authenticateWithPassword({
        clientId,
        email: normalizedEmail,
        password,
      });
    } catch (error) {
      if (isInvalidCredentialsError(error)) {
        return loginFailure("E-Mail oder Passwort ist falsch.");
      }

      throw error;
    }

    await ctx.runMutation(internal.users.storeUser, {
      ...clientUserFromWorkosUser(authentication.user),
    });

    return loginSuccess({
      ...clientSessionFromAuthentication(authentication),
    });
  },
});

export const refreshSession = action({
  args: {
    refreshToken: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmedRefreshToken = args.refreshToken.trim();
    if (!trimmedRefreshToken) {
      throw new Error("Keine gültige Sitzung vorhanden.");
    }

    const authentication = await getWorkOS().userManagement.authenticateWithRefreshToken({
      clientId: getClientId(),
      refreshToken: trimmedRefreshToken,
    });

    await ctx.runMutation(internal.users.storeUser, {
      ...clientUserFromWorkosUser(authentication.user),
    });

    return clientSessionFromAuthentication(authentication);
  },
});
