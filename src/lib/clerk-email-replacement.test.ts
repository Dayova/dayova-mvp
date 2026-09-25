import { describe, expect, test, vi } from "vitest";
import {
	getPendingEmailReplacement,
	replacePrimaryEmail,
	resumePrimaryEmailReplacement,
	type EmailReplacementUser,
} from "./clerk-email-replacement";

function createUser() {
	const events: string[] = [];
	const user: EmailReplacementUser = {
		primaryEmailAddress: { id: "old" },
		emailAddresses: [
			{
				id: "old",
				verification: { status: "verified" },
				destroy: vi.fn(async () => {
					events.push("destroy old");
					user.emailAddresses = user.emailAddresses.filter(
						(address) => address.id !== "old",
					);
				}),
			},
			{
				id: "new",
				verification: { status: "verified" },
				destroy: vi.fn(async () => {
					events.push("destroy new");
				}),
			},
			{
				id: "other",
				verification: { status: "verified" },
				destroy: vi.fn(async () => {
					events.push("destroy other");
				}),
			},
		],
		unsafeMetadata: {},
		update: vi.fn(async ({ primaryEmailAddressId }) => {
			events.push("switch primary");
			user.primaryEmailAddress = { id: primaryEmailAddressId };
		}),
		updateMetadata: vi.fn(async ({ unsafeMetadata }) => {
			events.push(
				unsafeMetadata.pendingPrimaryEmailReplacement ? "mark" : "clear",
			);
			user.unsafeMetadata = { ...user.unsafeMetadata, ...unsafeMetadata };
		}),
	};
	return { user, events };
}

describe("primary email replacement", () => {
	test("removes only the former primary after switching and clears the marker", async () => {
		const { user, events } = createUser();
		expect(await replacePrimaryEmail(user, "old", "new")).toBe("complete");
		expect(events).toEqual(["mark", "switch primary", "destroy old", "clear"]);
		expect(user.primaryEmailAddress?.id).toBe("new");
		expect(user.emailAddresses.map((address) => address.id)).toEqual([
			"new",
			"other",
		]);
	});

	test("keeps a retry marker when deleting the old address fails", async () => {
		const { user, events } = createUser();
		const oldAddress = user.emailAddresses[0];
		if (!oldAddress) throw new Error("Missing test address");
		oldAddress.destroy = vi.fn(async () => {
			throw new Error("network error");
		});
		expect(await replacePrimaryEmail(user, "old", "new")).toBe(
			"cleanup_pending",
		);
		expect(getPendingEmailReplacement(user)).toEqual({
			previousId: "old",
			nextId: "new",
		});
		expect(events).toEqual(["mark", "switch primary"]);

		oldAddress.destroy = vi.fn(async () => {
			events.push("destroy old");
			user.emailAddresses = user.emailAddresses.filter(
				(address) => address.id !== "old",
			);
		});
		expect(await resumePrimaryEmailReplacement(user)).toBe("complete");
		expect(events).toEqual(["mark", "switch primary", "destroy old", "clear"]);
	});

	test("resumes a primary switch that failed after writing the marker", async () => {
		const { user } = createUser();
		user.update = vi.fn(async () => {
			throw new Error("network error");
		});
		expect(await replacePrimaryEmail(user, "old", "new")).toBe(
			"activation_pending",
		);
		expect(getPendingEmailReplacement(user)).toEqual({
			previousId: "old",
			nextId: "new",
		});
		user.update = vi.fn(async ({ primaryEmailAddressId }) => {
			user.primaryEmailAddress = { id: primaryEmailAddressId };
		});
		expect(await resumePrimaryEmailReplacement(user)).toBe("complete");
		expect(user.emailAddresses.map((address) => address.id)).toEqual([
			"new",
			"other",
		]);
	});

	test("does not delete an address when another primary took over", async () => {
		const { user } = createUser();
		user.unsafeMetadata.pendingPrimaryEmailReplacement = {
			previousId: "old",
			nextId: "new",
		};
		user.primaryEmailAddress = { id: "other" };
		expect(await resumePrimaryEmailReplacement(user)).toBe("complete");
		expect(user.emailAddresses.map((address) => address.id)).toContain("old");
		expect(getPendingEmailReplacement(user)).toBeNull();
	});

	test("discards the marker if the verified replacement address was removed", async () => {
		const { user } = createUser();
		user.unsafeMetadata.pendingPrimaryEmailReplacement = {
			previousId: "old",
			nextId: "new",
		};
		user.emailAddresses = user.emailAddresses.filter(
			(address) => address.id !== "new",
		);
		expect(await resumePrimaryEmailReplacement(user)).toBe("complete");
		expect(user.primaryEmailAddress?.id).toBe("old");
		expect(getPendingEmailReplacement(user)).toBeNull();
	});

	test("keeps the marker if verification is temporarily not visible", async () => {
		const { user } = createUser();
		user.unsafeMetadata.pendingPrimaryEmailReplacement = {
			previousId: "old",
			nextId: "new",
		};
		const next = user.emailAddresses[1];
		if (!next) throw new Error("Missing test address");
		next.verification = { status: "unverified" };
		expect(await resumePrimaryEmailReplacement(user)).toBe("cleanup_pending");
		expect(getPendingEmailReplacement(user)).not.toBeNull();
	});

	test("rejects an unverified replacement without mutating the user", async () => {
		const { user, events } = createUser();
		const next = user.emailAddresses[1];
		if (!next) throw new Error("Missing test address");
		next.verification = { status: "unverified" };
		await expect(replacePrimaryEmail(user, "old", "new")).rejects.toThrow(
			"noch nicht bestätigt",
		);
		expect(events).toEqual([]);
	});

	test("does not overwrite an unfinished replacement with a second one", async () => {
		const { user, events } = createUser();
		user.unsafeMetadata.pendingPrimaryEmailReplacement = {
			previousId: "old",
			nextId: "other",
		};
		await expect(replacePrimaryEmail(user, "old", "new")).rejects.toThrow(
			"noch nicht abgeschlossen",
		);
		expect(events).toEqual([]);
		expect(getPendingEmailReplacement(user)).toEqual({
			previousId: "old",
			nextId: "other",
		});
	});
});
