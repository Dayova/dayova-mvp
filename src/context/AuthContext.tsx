import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
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
  accessToken: string | null;
  isLoading: boolean;
  setIsLoading: (next: boolean) => void;
  setSession: (result: AuthResult) => void;
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AuthSessionContext = createContext<AuthSessionContextType | undefined>(
  undefined,
);

const userFromResult = ({
  accessToken: _accessToken,
  ...user
}: AuthResult): AuthUser => user;

export const AuthSessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const setSession = (result: AuthResult) => {
    setUser(userFromResult(result));
    setAccessToken(result.accessToken);
  };

  const clearSession = () => {
    setUser(null);
    setAccessToken(null);
  };

  return (
    <AuthSessionContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        setIsLoading,
        setSession,
        clearSession,
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
  const { accessToken, isLoading, user } = useAuthSession();
  const fetchAccessToken = useCallback(async () => accessToken, [accessToken]);

  return {
    isLoading,
    isAuthenticated: Boolean(user && accessToken),
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

    session.setSession(result.user);
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
    session.setSession(registeredUser);
  };

  const logout = async () => {
    session.clearSession();
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
