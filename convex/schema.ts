import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    workosId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  })
    .index("by_workosId", ["workosId"])
    .index("by_email", ["email"]),
});
