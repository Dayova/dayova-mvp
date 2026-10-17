import { v } from "convex/values";
import { env, internalMutation } from "./_generated/server";
import { enqueueClerkDeletedAccount } from "./accountDeletion";
import { getClerkIdentity } from "./clerkIdentity";
import { enqueueCrmUpdate } from "./crmUpdates";

export const apply = internalMutation({
	args: {
		instanceId: v.string(),
		clerkId: v.string(),
		updatedAt: v.number(),
		eventAt: v.number(),
		verifiedEmail: v.optional(v.string()),
		deleted: v.boolean(),
	},
	returns: v.union(v.literal("applied"), v.literal("ignored")),
	handler: async (ctx, args) => {
		if (
			!env.CLERK_JWT_ISSUER_DOMAIN ||
			!env.CLERK_WEBHOOK_INSTANCE_ID ||
			args.instanceId !== env.CLERK_WEBHOOK_INSTANCE_ID
		)
			throw new Error("Wrong Clerk instance");
		const tokenIdentifier = `${env.CLERK_JWT_ISSUER_DOMAIN}|${args.clerkId}`;
		const existing = await getClerkIdentity(ctx, tokenIdentifier);
		if (existing?.deletedAt !== undefined) {
			// A confirmed provider deletion unblocks an app deletion awaiting Clerk.
			if (args.deleted) {
				const request = await ctx.db
					.query("accountDeletionRequests")
					.withIndex("by_ownerTokenIdentifier", (q) =>
						q.eq("ownerTokenIdentifier", tokenIdentifier),
					)
					.unique();
				if (
					request &&
					["revokeSessions", "deleteClerkIdentity"].includes(request.stage)
				)
					await enqueueClerkDeletedAccount(
						ctx,
						tokenIdentifier,
						args.clerkId,
						args.eventAt,
					);
			}
			return "ignored";
		}
		if (args.deleted) {
			await enqueueClerkDeletedAccount(
				ctx,
				tokenIdentifier,
				args.clerkId,
				args.eventAt,
			);
			return "applied";
		}
		if (
			existing &&
			(args.updatedAt < existing.updatedAt ||
				(args.updatedAt === existing.updatedAt &&
					args.eventAt <= existing.eventAt))
		)
			return "ignored";
		const value = {
			tokenIdentifier,
			clerkId: args.clerkId,
			updatedAt: args.updatedAt,
			eventAt: args.eventAt,
			verifiedEmail: args.verifiedEmail,
		};
		if (existing) await ctx.db.patch("clerkIdentities", existing._id, value);
		else await ctx.db.insert("clerkIdentities", value);
		const user = await ctx.db
			.query("users")
			.withIndex("by_tokenIdentifier", (q) =>
				q.eq("tokenIdentifier", tokenIdentifier),
			)
			.unique();
		if (user && user.email !== (args.verifiedEmail ?? "")) {
			await ctx.db.patch("users", user._id, {
				email: args.verifiedEmail ?? "",
			});
			await enqueueCrmUpdate(ctx, user._id);
		}
		// Authentication still creates the app profile/onboarding and signup queue.
		return "applied";
	},
});
