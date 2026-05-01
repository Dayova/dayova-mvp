import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useAction } from "convex/react";
import { api } from "#convex/_generated/api";

type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = {
  email: string;
  password: string;
  name?: string;
  phone?: string;
  birthDate?: string;
};

type AuthUser = {
  workosId: string;
  email: string;
  name?: string;
  phone?: string;
  birthDate?: string;
  avatarUrl?: string;
};

type AuthResult = AuthUser & {
  accessToken: string;
  refreshToken: string;
};

type StoredSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number | null;
};

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

type AuthSessionContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  setIsLoading: (next: boolean) => void;
  setSession: (result: AuthResult) => Promise<void>;
  clearSession: () => Promise<void>;
  getFreshAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AuthSessionContext = createContext<AuthSessionContextType | undefined>(
  undefined,
);
const SESSION_STORAGE_KEY = "dayova.auth.session.v1";
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const FALLBACK_TOKEN_TTL_MS = 5 * 60_000;

class SessionRefreshError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const getConvexSiteUrl = () => {
  const configuredSiteUrl = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;
  if (configuredSiteUrl) return configuredSiteUrl.replace(/\/$/, "");

  const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
  if (convexUrl) {
    return convexUrl.replace(/\/$/, "").replace(".convex.cloud", ".convex.site");
  }

  return "https://placeholder.convex.site";
};

const userFromResult = ({
  accessToken: _accessToken,
  refreshToken: _refreshToken,
  ...user
}: AuthResult): AuthUser => user;

const decodeJwtPayload = (token: string): { exp?: number } | null => {
  const [, payload] = token.split(".");
  if (!payload || typeof globalThis.atob !== "function") return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const binary = globalThis.atob(padded);
    const json = decodeURIComponent(
      Array.from(binary)
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const getAccessTokenExpiresAt = (accessToken: string) => {
  const exp = decodeJwtPayload(accessToken)?.exp;
  return typeof exp === "number" ? exp * 1000 : Date.now() + FALLBACK_TOKEN_TTL_MS;
};

const sessionFromResult = (result: AuthResult): StoredSession => ({
  user: userFromResult(result),
  accessToken: result.accessToken,
  refreshToken: result.refreshToken,
  accessTokenExpiresAt: getAccessTokenExpiresAt(result.accessToken),
});

const isAccessTokenFresh = (session: StoredSession) =>
  session.accessTokenExpiresAt !== null &&
  session.accessTokenExpiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS;

const readStoredSession = async (): Promise<StoredSession | null> => {
  try {
    const raw =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(SESSION_STORAGE_KEY)
        : await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      !parsed.user ||
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string"
    ) {
      return null;
    }

    return {
      user: parsed.user,
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      accessTokenExpiresAt:
        typeof parsed.accessTokenExpiresAt === "number"
          ? parsed.accessTokenExpiresAt
          : getAccessTokenExpiresAt(parsed.accessToken),
    };
  } catch {
    return null;
  }
};

const writeStoredSession = async (session: StoredSession) => {
  const serialized = JSON.stringify(session);
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(SESSION_STORAGE_KEY, serialized);
    return;
  }

  await SecureStore.setItemAsync(SESSION_STORAGE_KEY, serialized, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
};

const deleteStoredSession = async () => {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
};

const refreshSessionRequest = async (refreshToken: string): Promise<AuthResult> => {
  const response = await fetch(`${getConvexSiteUrl()}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new SessionRefreshError("Session abgelaufen.", response.status);
  }

  return (await response.json()) as AuthResult;
};

export const AuthSessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [storedSession, setStoredSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionRef = useRef<StoredSession | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const setSessionState = useCallback((next: StoredSession | null) => {
    sessionRef.current = next;
    setStoredSession(next);
  }, []);

  const clearSession = useCallback(async () => {
    refreshPromiseRef.current = null;
    setSessionState(null);
    await deleteStoredSession();
  }, [setSessionState]);

  const refreshStoredSession = useCallback(
    async (refreshToken?: string, force = false) => {
      const currentSession = sessionRef.current;
      if (!force && currentSession && isAccessTokenFresh(currentSession)) {
        return currentSession.accessToken;
      }

      const token = refreshToken ?? currentSession?.refreshToken;
      if (!token) return null;

      if (refreshPromiseRef.current) {
        return await refreshPromiseRef.current;
      }

      refreshPromiseRef.current = (async () => {
        try {
          const result = await refreshSessionRequest(token);
          const nextSession = sessionFromResult(result);
          setSessionState(nextSession);
          await writeStoredSession(nextSession);
          return nextSession.accessToken;
        } catch (error) {
          if (
            error instanceof SessionRefreshError &&
            (error.status === 400 || error.status === 401)
          ) {
            await clearSession();
            return null;
          }

          return currentSession?.accessToken ?? null;
        } finally {
          refreshPromiseRef.current = null;
        }
      })();

      return await refreshPromiseRef.current;
    },
    [clearSession, setSessionState],
  );

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const session = await readStoredSession();
      if (cancelled) return;

      if (!session) {
        setIsLoading(false);
        return;
      }

      if (isAccessTokenFresh(session)) {
        setSessionState(session);
        setIsLoading(false);
        return;
      }

      sessionRef.current = session;
      await refreshStoredSession(session.refreshToken, true);
      if (!cancelled) setIsLoading(false);
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [refreshStoredSession, setSessionState]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && sessionRef.current) {
        void refreshStoredSession();
      }
    });

    return () => subscription.remove();
  }, [refreshStoredSession]);

  const setSession = useCallback(
    async (result: AuthResult) => {
      const nextSession = sessionFromResult(result);
      setSessionState(nextSession);
      await writeStoredSession(nextSession);
    },
    [setSessionState],
  );

  const getFreshAccessToken = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return null;
    if (isAccessTokenFresh(session)) return session.accessToken;

    return await refreshStoredSession(session.refreshToken, true);
  }, [refreshStoredSession]);

  return (
    <AuthSessionContext.Provider
      value={{
        user: storedSession?.user ?? null,
        isLoading,
        setIsLoading,
        setSession,
        clearSession,
        getFreshAccessToken,
      }}
    >
      {children}
    </AuthSessionContext.Provider>
  );
};

const useAuthSession = () => {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error("useAuthSession must be used within an AuthSessionProvider");
  }
  return context;
};

export const useConvexWorkosAuth = () => {
  const { getFreshAccessToken, isLoading, user } = useAuthSession();
  const fetchAccessToken = useCallback(
    async () => await getFreshAccessToken(),
    [getFreshAccessToken],
  );

  return {
    isLoading,
    isAuthenticated: Boolean(user),
    fetchAccessToken,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const session = useAuthSession();
  const loginAction = useAction(api.auth.loginWithPassword);
  const registerAction = useAction(api.auth.registerWithPassword);

  const withLoading = async <TResult,>(task: () => Promise<TResult>) => {
    session.setIsLoading(true);
    try {
      return await task();
    } finally {
      session.setIsLoading(false);
    }
  };

  const login = async (input: LoginInput) => {
    const result = await withLoading(() =>
      loginAction({
        email: input.email,
        password: input.password,
      }),
    );
    if (!result?.ok) {
      throw new Error(result.error);
    }

    if (!result.user) {
      throw new Error("Anmeldung fehlgeschlagen.");
    }

    await session.setSession(result.user);
  };

  const register = async (input: RegisterInput) => {
    const registeredUser = await withLoading(() =>
      registerAction({
        email: input.email,
        password: input.password,
        name: input.name,
        phone: input.phone,
        birthDate: input.birthDate,
      }),
    );
    await session.setSession(registeredUser);
  };

  const logout = async () => {
    await session.clearSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user: session.user,
        isLoading: session.isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
