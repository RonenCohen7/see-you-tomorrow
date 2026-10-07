import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loginRequest, logoutRequest, meRequest, type Employee } from "@/api/client";
import { clearTokens, readAccessToken, saveApiUrl, saveTokens } from "@/api/session";

type Status = "loading" | "signedOut" | "signedIn";

type AuthValue = {
  status: Status;
  user: Employee | null;
  login: (input: { email: string; password: string; tenantSlug?: string; apiUrl: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<Employee | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await readAccessToken();
      if (!token) {
        if (!cancelled) setStatus("signedOut");
        return;
      }
      try {
        const profile = await meRequest();
        if (cancelled) return;
        setUser(profile);
        setStatus("signedIn");
      } catch {
        await clearTokens();
        if (!cancelled) {
          setUser(null);
          setStatus("signedOut");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (input: { email: string; password: string; tenantSlug?: string; apiUrl: string }) => {
      await saveApiUrl(input.apiUrl);
      const result = await loginRequest(input);
      await saveTokens(result.accessToken, result.refreshToken);
      setUser(result.employee);
      setStatus("signedIn");
    },
    []
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    await clearTokens();
    setUser(null);
    setStatus("signedOut");
  }, []);

  const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
