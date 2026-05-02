import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

const normalizeEmail = (email?: string) => email?.trim().toLowerCase() ?? "";

const requireIdentity = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Nicht authentifiziert.");
  }
  return identity;
};

const profileFields = (args: {
  name?: string;
  phone?: string;
  birthDate?: string;
  avatarUrl?: string;
}) => ({
  ...(args.name !== undefined ? { name: args.name } : {}),
  ...(args.phone !== undefined ? { phone: args.phone } : {}),
  ...(args.birthDate !== undefined ? { birthDate: args.birthDate } : {}),
  ...(args.avatarUrl !== undefined ? { avatarUrl: args.avatarUrl } : {}),
});

export const syncCurrentUser = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const email = normalizeEmail(identity.email);

    if (!email) {
      throw new Error("Beim angemeldeten Konto fehlt die E-Mail-Adresse.");
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    const user = {
      tokenIdentifier: identity.tokenIdentifier,
      clerkId: identity.subject,
      email,
      name: args.name ?? identity.name,
      ...profileFields(args),
    };

    if (existingUser) {
      await ctx.db.patch(existingUser._id, user);
      return existingUser._id;
    }

    return await ctx.db.insert("users", user);
  },
});

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);

    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
  },
});
