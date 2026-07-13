import { describe, expect, test, vi } from "vitest";

vi.mock("@clerk/expo/token-cache", () => ({ tokenCache: undefined }));

import {
	createPreferenceAwareTokenCache,
	type TokenCache,
} from "./auth-token-cache";

const createPersistentCache = (tokens = new Map<string, string>()) => {
	const cache: TokenCache = {
		getToken: vi.fn(async (key) => tokens.get(key)),
		saveToken: vi.fn(async (key, token) => {
			tokens.set(key, token);
		}),
		clearToken: vi.fn(async (key) => {
			tokens.delete(key);
		}),
	};

	return { cache, tokens };
};

describe("preference-aware auth token cache", () => {
	test("persists tokens by default", async () => {
		const persistent = createPersistentCache();
		const cache = createPreferenceAwareTokenCache(persistent.cache);

		await cache.tokenCache.saveToken("session", "remembered-token");

		expect(persistent.tokens.get("session")).toBe("remembered-token");
	});

	test("keeps an unremembered session in memory but not across restarts", async () => {
		const persistent = createPersistentCache(
			new Map([["session", "old-token"]]),
		);
		const cache = createPreferenceAwareTokenCache(persistent.cache);

		expect(await cache.tokenCache.getToken("session")).toBe("old-token");
		await cache.setRememberSession(false);
		await cache.tokenCache.saveToken("session", "ephemeral-token");

		expect(await cache.tokenCache.getToken("session")).toBe("ephemeral-token");
		expect(persistent.tokens.has("session")).toBe(false);

		const restartedCache = createPreferenceAwareTokenCache(persistent.cache);
		expect(await restartedCache.tokenCache.getToken("session")).toBeUndefined();
	});

	test("does not restore an unknown persistent token after remembering is disabled", async () => {
		const persistent = createPersistentCache(
			new Map([["session", "stale-token"]]),
		);
		const cache = createPreferenceAwareTokenCache(persistent.cache);

		await cache.setRememberSession(false);

		expect(await cache.tokenCache.getToken("session")).toBeUndefined();
		expect(persistent.tokens.has("session")).toBe(false);
	});

	test("persists the in-memory token when remembering is enabled again", async () => {
		const persistent = createPersistentCache();
		const cache = createPreferenceAwareTokenCache(persistent.cache);

		await cache.setRememberSession(false);
		await cache.tokenCache.saveToken("session", "ephemeral-token");
		await cache.setRememberSession(true);

		expect(persistent.tokens.get("session")).toBe("ephemeral-token");
	});

	test("clears memory and persistent storage when Clerk signs out", async () => {
		const persistent = createPersistentCache();
		const cache = createPreferenceAwareTokenCache(persistent.cache);
		await cache.tokenCache.saveToken("session", "remembered-token");

		await cache.tokenCache.clearToken?.("session");

		expect(await cache.tokenCache.getToken("session")).toBeUndefined();
		expect(persistent.tokens.has("session")).toBe(false);
	});
});
