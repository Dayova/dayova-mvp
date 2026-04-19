import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const storeUser = mutation({
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
        name: args.name,
        phone: args.phone,
        birthDate: args.birthDate,
        avatarUrl: args.avatarUrl,
      });
      return user._id;
    }

    return await ctx.db.insert("users", {
      workosId: args.workosId,
      email: normalizeEmail(args.email),
      name: args.name,
      phone: args.phone,
      birthDate: args.birthDate,
      avatarUrl: args.avatarUrl,
    });
  },
});

export const getMe = query({
  args: { workosId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_workosId", (q) => q.eq("workosId", args.workosId))
      .unique();
  },
});

export const removeLegacyPasswordField = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let updated = 0;

    for (const user of users) {
      if (!("password" in user)) continue;

      await ctx.db.replace(user._id, {
        workosId: user.workosId,
        email: user.email,
        name: user.name,
        phone: user.phone,
        birthDate: user.birthDate,
        avatarUrl: user.avatarUrl,
      });
      updated += 1;
    }

    return { updated, total: users.length };
  },
});
