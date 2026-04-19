"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
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
      throw new Error("Bitte einen gueltigen Namen eingeben.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error("Bitte eine gueltige E-Mail eingeben.");
    }
    if (!/^\+?[0-9()\-.\s]{7,20}$/.test(trimmedPhone)) {
      throw new Error("Bitte eine gueltige Telefonnummer eingeben.");
    }
    if (!isValidBirthDate(trimmedBirthDate)) {
      throw new Error("Bitte ein gueltiges Geburtsdatum (TT.MM.JJJJ) eingeben.");
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

    await ctx.runMutation(api.users.storeUser, {
      workosId: created.id,
      email: created.email,
      name: fullNameFromParts(created.firstName, created.lastName) ?? trimmedName,
      phone: trimmedPhone,
      birthDate: trimmedBirthDate,
      avatarUrl: created.profilePictureUrl ?? undefined,
    });

    return {
      workosId: created.id,
      email: created.email,
      name: fullNameFromParts(created.firstName, created.lastName) ?? trimmedName,
      phone: trimmedPhone,
      birthDate: trimmedBirthDate,
      avatarUrl: created.profilePictureUrl ?? undefined,
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

    const authentication = await workos.userManagement.authenticateWithPassword({
      clientId,
      email: normalizedEmail,
      password: args.password,
    });

    await ctx.runMutation(api.users.storeUser, {
      workosId: authentication.user.id,
      email: authentication.user.email,
      name: fullNameFromParts(authentication.user.firstName, authentication.user.lastName),
      avatarUrl: authentication.user.profilePictureUrl ?? undefined,
    });

    return {
      workosId: authentication.user.id,
      email: authentication.user.email,
      name: fullNameFromParts(authentication.user.firstName, authentication.user.lastName),
      avatarUrl: authentication.user.profilePictureUrl ?? undefined,
    };
  },
});
