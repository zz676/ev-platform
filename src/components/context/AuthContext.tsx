"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";

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
  login: () => void; // Opens login modal
  loginWithGoogle: () => Promise<void>;
  loginWithX: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapSupabaseUser(supabaseUser: SupabaseUser, dbRole?: "admin" | "user"): User {
  const email = supabaseUser.email || "";

  return {
    id: supabaseUser.id,
    name:
      supabaseUser.user_metadata?.full_name ||
      supabaseUser.user_metadata?.name ||
      email.split("@")[0] ||
      "User",
    email,
    role: dbRole || "user", // Use role from database, default to user
    avatarUrl:
      supabaseUser.user_metadata?.avatar_url ||
      supabaseUser.user_metadata?.picture,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // Sync user to database and get role from DB
  const syncUserToDb = useCallback(async (supabaseUser: SupabaseUser): Promise<"admin" | "user" | null> => {
    try {
      const response = await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: supabaseUser.id }),
      });
      if (response.ok) {
        const data = await response.json();
        // Return role from database (convert ADMIN/USER to admin/user)
        return data.user?.role?.toLowerCase() as "admin" | "user" || "user";
      }
      return null;
    } catch (error) {
      console.error("Failed to sync user to database:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          // Sync to DB and get role
          const dbRole = await syncUserToDb(session.user);
          setUser(mapSupabaseUser(session.user, dbRole || undefined));
        }
      } catch (error) {
        console.error("Error getting session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: string, session: Session | null) => {
        if (session?.user) {
          if (event === "SIGNED_IN") {
            // On sign in, sync to DB and get role
            const dbRole = await syncUserToDb(session.user);
            setUser(mapSupabaseUser(session.user, dbRole || undefined));
          } else {
            // For other events, just update user with current role
            setUser((prev) => mapSupabaseUser(session.user, prev?.role));
          }
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, syncUserToDb]);

  // Placeholder login - will be replaced by LoginModal opening
  const login = useCallback(() => {
    // This will be overridden by LoginModalContext to open the modal
    // For now, redirect to a simple login
    window.dispatchEvent(new CustomEvent("open-login-modal"));
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      console.error("Google login error:", error);
      throw error;
    }
  }, [supabase]);

  const loginWithX = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "twitter",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      console.error("X login error:", error);
      throw error;
    }
  }, [supabase]);

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    },
    [supabase]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, name: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/confirm`,
          data: {
            full_name: name,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    },
    [supabase]
  );

  const logout = useCallback(async () => {
    try {
      // Sign out from Supabase (clears session on server and local storage)
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      // Always clear user state even if signOut fails
      setUser(null);
    }
  }, [supabase]);

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        login,
        loginWithGoogle,
        loginWithX,
        loginWithEmail,
        signUpWithEmail,
        logout,
      }}
    >
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
