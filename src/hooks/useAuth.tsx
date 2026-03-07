import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import {
  login as apiLogin,
  logout as apiLogout,
  fetchMe,
  getStoredUser,
  getToken,
  clearAuth,
  type AuthUser,
} from "@/lib/authApi";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  userRole: "admin" | "user" | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      try {
        const token = getToken();
        const stored = getStoredUser();
        if (token && stored) {
          setUser(stored);
          // Validate token by fetching fresh user data
          try {
            const fresh = await fetchMe();
            setUser(fresh);
          } catch {
            clearAuth();
            setUser(null);
          }
        }
      } catch { setUser(null); }
      finally { setIsLoading(false); }
    };
    restore();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      const u = await apiLogin(email, password);
      setUser(u);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error("Login failed") };
    }
  };

  const signOut = async () => {
    apiLogout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const u = await fetchMe();
      setUser(u);
    } catch { /* ignore */ }
  };

  const isAdmin = user?.role === "admin";
  const userRole = user?.role ?? null;

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdmin, userRole, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
