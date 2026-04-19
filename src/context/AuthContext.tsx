import React, { createContext, useContext, useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

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

interface AuthContextType {
  user: any;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loginAction = useAction(api.auth.loginWithPassword);
  const registerAction = useAction(api.auth.registerWithPassword);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const withLoading = async <TResult,>(task: () => Promise<TResult>) => {
    setIsLoading(true);
    try {
      return await task();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (input: LoginInput) => {
    const authenticatedUser = await withLoading(() =>
      loginAction({
        email: input.email,
        password: input.password,
      })
    );
    setUser(authenticatedUser);
  };

  const register = async (input: RegisterInput) => {
    const registeredUser = await withLoading(() =>
      registerAction({
        email: input.email,
        password: input.password,
        name: input.name,
        phone: input.phone,
        birthDate: input.birthDate,
      })
    );
    setUser(registeredUser);
  };

  const logout = async () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
