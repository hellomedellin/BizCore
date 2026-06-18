import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { setAuthToken } from "./api";

interface AuthUser {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  businessId: string;
  employeeId: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoaded: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);
const TOKEN_KEY = "bizcore_token";
const USER_KEY = "bizcore_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) ?? "null"); } catch { return null; }
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Inject token into axios on mount
    setAuthToken(token);
    setIsLoaded(true);
  }, [token]);

  async function login(username: string, password: string): Promise<void> {
    const BASE = (import.meta.env.VITE_API_URL as string | undefined)
      ? `${import.meta.env.VITE_API_URL}/api/v1`
      : "/api/v1";
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error ?? "Login failed");
    }
    const data = await res.json() as { token: string; user: AuthUser };
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setAuthToken(data.token);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setAuthToken(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoaded, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
