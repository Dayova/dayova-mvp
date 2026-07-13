import { tokenCache as secureTokenCache } from "@clerk/expo/token-cache";

export type TokenCache = {
	getToken: (key: string) => Promise<string | null | undefined>;
	saveToken: (key: string, token: string) => Promise<void>;
	clearToken?: (key: string) => Promise<void> | void;
};

export const createPreferenceAwareTokenCache = (
	persistentCache?: TokenCache,
) => {
	const memoryTokens = new Map<string, string>();
	const knownKeys = new Set<string>();
	let rememberSession = true;

	const clearPersistentToken = async (key: string) => {
		await persistentCache?.clearToken?.(key);
	};

	const tokenCache: TokenCache = {
		getToken: async (key) => {
			knownKeys.add(key);
			const memoryToken = memoryTokens.get(key);
			if (memoryToken !== undefined) return memoryToken;
			if (!rememberSession) {
				await clearPersistentToken(key);
				return undefined;
			}

			const persistentToken = await persistentCache?.getToken(key);
			if (persistentToken != null) {
				memoryTokens.set(key, persistentToken);
			}
			return persistentToken;
		},
		saveToken: async (key, token) => {
			knownKeys.add(key);
			memoryTokens.set(key, token);
			if (rememberSession) {
				await persistentCache?.saveToken(key, token);
				return;
			}

			await clearPersistentToken(key);
		},
		clearToken: async (key) => {
			knownKeys.add(key);
			memoryTokens.delete(key);
			await clearPersistentToken(key);
		},
	};

	const setRememberSession = async (remember: boolean) => {
		rememberSession = remember;
		if (!remember) {
			await Promise.all([...knownKeys].map(clearPersistentToken));
			return;
		}

		await Promise.all(
			[...memoryTokens].map(([key, token]) =>
				persistentCache?.saveToken(key, token),
			),
		);
	};

	return {
		tokenCache,
		setRememberSession,
		getRememberSession: () => rememberSession,
	};
};

const authTokenCache = createPreferenceAwareTokenCache(secureTokenCache);

export const clerkTokenCache = authTokenCache.tokenCache;
export const setRememberSessionPersistence = authTokenCache.setRememberSession;
export const getRememberSessionPersistence = authTokenCache.getRememberSession;
