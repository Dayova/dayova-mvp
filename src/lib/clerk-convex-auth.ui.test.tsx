import { expect, jest, test } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";
import { useClerkConvexAuth } from "./clerk-convex-auth";

let mockPrimaryEmail = "old@example.com";
let mockSessionId = "session-1";
let mockSessionClaims: Record<string, unknown> = {};
const mockGetToken = jest.fn(async (): Promise<string | null> => "fresh-token");

jest.mock("@clerk/expo", () => ({
	useAuth: () => ({
		isLoaded: true,
		isSignedIn: true,
		getToken: mockGetToken,
		orgId: null,
		orgRole: null,
		sessionId: mockSessionId,
		sessionClaims: mockSessionClaims,
	}),
	useUser: () => ({
		user: { primaryEmailAddress: { emailAddress: mockPrimaryEmail } },
	}),
}));

test("a primary email change refreshes the Convex token without Clerk's cache", async () => {
	mockPrimaryEmail = "old@example.com";
	mockSessionId = "session-1";
	mockGetToken.mockClear();
	const { result, rerender } = await renderHook(() => useClerkConvexAuth());
	const oldFetcher = result.current.fetchAccessToken;
	await oldFetcher({ forceRefreshToken: false });
	await oldFetcher({ forceRefreshToken: false });
	expect(mockGetToken).toHaveBeenNthCalledWith(1, {
		template: "convex",
		skipCache: true,
	});
	expect(mockGetToken).toHaveBeenNthCalledWith(2, {
		template: "convex",
		skipCache: false,
	});

	mockPrimaryEmail = "new@example.com";
	await rerender({});
	const newFetcher = result.current.fetchAccessToken;
	expect(newFetcher).not.toBe(oldFetcher);
	await expect(newFetcher({ forceRefreshToken: false })).resolves.toBe(
		"fresh-token",
	);
	expect(mockGetToken).toHaveBeenNthCalledWith(3, {
		template: "convex",
		skipCache: true,
	});
	await newFetcher({ forceRefreshToken: true });
	expect(mockGetToken).toHaveBeenNthCalledWith(4, {
		template: "convex",
		skipCache: true,
	});

	mockSessionId = "session-2";
	await rerender({});
	expect(result.current.fetchAccessToken).not.toBe(newFetcher);
});

test("a failed fresh fetch never reuses a token from the previous identity", async () => {
	mockSessionId = "session-3";
	mockGetToken.mockClear();
	mockGetToken.mockResolvedValueOnce(null);
	const { result } = await renderHook(() => useClerkConvexAuth());
	await expect(
		result.current.fetchAccessToken({ forceRefreshToken: false }),
	).resolves.toBeNull();
	expect(mockGetToken).toHaveBeenNthCalledWith(1, {
		template: "convex",
		skipCache: true,
	});
	expect(mockGetToken).toHaveBeenCalledTimes(1);
});

test("requests the email-bearing template even when the session audience is convex", async () => {
	mockSessionClaims = { aud: "convex" };
	mockGetToken.mockClear();
	const { result } = await renderHook(() => useClerkConvexAuth());
	await result.current.fetchAccessToken({ forceRefreshToken: false });
	expect(mockGetToken).toHaveBeenCalledWith({
		template: "convex",
		skipCache: true,
	});
	mockSessionClaims = {};
});
