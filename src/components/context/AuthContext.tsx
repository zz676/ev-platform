"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock admin user for testing
const MOCK_ADMIN_USER: User = {
  id: "admin-001",
  name: "Admin User",
  email: "admin@evjuicy.com",
  role: "admin",
  avatarUrl: undefined,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(() => {
    setIsLoading(true);
    // Simulate login delay
    setTimeout(() => {
      setUser(MOCK_ADMIN_USER);
      setIsLoading(false);
    }, 300);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, isAdmin, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
