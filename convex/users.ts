import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const optionalUserFields = (args: {
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

export const storeUser = internalMutation({
  args: {
    workosId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_workosId", (q) => q.eq("workosId", args.workosId))
      .unique();

    if (user !== null) {
      await ctx.db.patch(user._id, {
        email: normalizeEmail(args.email),
        ...optionalUserFields(args),
      });
      return user._id;
    }

    return await ctx.db.insert("users", {
      workosId: args.workosId,
      email: normalizeEmail(args.email),
      ...optionalUserFields(args),
    });
  },
});

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Nicht authentifiziert.");
    }

    return await ctx.db
      .query("users")
      .withIndex("by_workosId", (q) => q.eq("workosId", identity.subject))
      .unique();
  },
});

export const removeLegacyPasswordField = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(100);
    let updated = 0;

    for (const user of users) {
      if (!("password" in user)) continue;

      await ctx.db.replace(user._id, {
        workosId: user.workosId,
        email: user.email,
        ...optionalUserFields(user),
      });
      updated += 1;
    }

    return { updated, total: users.length };
  },
});
