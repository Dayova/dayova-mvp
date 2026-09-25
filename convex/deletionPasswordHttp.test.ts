import { expect, test, vi } from "vitest";
import { handleDeletionPasswordRequest } from "./deletionPasswordHttp";

test.each([
	"missing-key",
	"wrong-password",
	"timeout",
	"malformed-proof",
])("fails closed without leaking provider details: %s", async (failure) => {
	const enqueue = vi.fn();
	const verify = vi.fn().mockImplementation(async () => {
		if (failure === "timeout") throw new Error("sensitive provider detail");
		return failure === "wrong-password"
			? new Response("sensitive provider detail", { status: 422 })
			: Response.json({ verified: "true" });
	});
	const response = await handleDeletionPasswordRequest(
		new Request("https://qa.test/delete", {
			method: "POST",
			body: JSON.stringify({ password: "test-only" }),
		}),
		{
			identity: {
				subject: "user",
				issuer: "issuer",
				tokenIdentifier: "issuer|user",
			},
			secretKey: failure === "missing-key" ? undefined : "key",
			verify,
			enqueue,
		},
	);
	expect(response.ok).toBe(false);
	expect(await response.text()).not.toContain("sensitive provider detail");
	expect(enqueue).not.toHaveBeenCalled();
	if (failure === "missing-key") expect(verify).not.toHaveBeenCalled();
});

test.each([
	false,
	true,
])("queues only after explicit Clerk verification: %s", async (verified) => {
	const enqueue = vi.fn().mockResolvedValue({ status: "accepted" });
	const verify = vi.fn().mockResolvedValue(Response.json({ verified }));
	const result = await handleDeletionPasswordRequest(
		new Request("https://qa.test/delete", {
			method: "POST",
			body: JSON.stringify({ password: "test-only", userId: "victim" }),
		}),
		{
			identity: {
				subject: "authenticated-user",
				issuer: "https://clerk.test",
				tokenIdentifier: "issuer|authenticated-user",
			},
			secretKey: "test-key",
			verify,
			enqueue,
		},
	);
	expect(result.status).toBe(verified ? 200 : 403);
	expect(enqueue).toHaveBeenCalledTimes(verified ? 1 : 0);
	expect(verify.mock.calls[0][0]).toContain(
		"/authenticated-user/verify_password",
	);
});

test("rejects unauthenticated requests before external verification", async () => {
	const verify = vi.fn();
	const enqueue = vi.fn();
	const response = await handleDeletionPasswordRequest(
		new Request("https://qa.test/delete"),
		{
			identity: null,
			secretKey: "test-key",
			verify,
			enqueue,
		},
	);
	expect(response.status).toBe(401);
	expect(verify).not.toHaveBeenCalled();
	expect(enqueue).not.toHaveBeenCalled();
});
