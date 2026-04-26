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
  dayEntries: defineTable({
    ownerTokenIdentifier: v.string(),
    dayKey: v.string(),
    title: v.string(),
    time: v.optional(v.string()),
    kind: v.optional(v.string()),
    notes: v.optional(v.string()),
    dueDateKey: v.optional(v.string()),
    dueDateLabel: v.optional(v.string()),
    plannedDateLabel: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    examTypeLabel: v.optional(v.string()),
  }).index("by_ownerTokenIdentifier_and_dayKey", [
    "ownerTokenIdentifier",
    "dayKey",
  ]),
});
