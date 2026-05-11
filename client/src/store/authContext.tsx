import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import api, { clearTokens, setTokens } from "../services/api";
import type { Employee, Role } from "../types/models";

type AuthState = {
  user: Employee | null;
  loading: boolean;
};

type AuthCtx = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    jobTitle?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get<Employee>("/api/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    clearTokens();
    const { data } = await api.post<{ accessToken: string; refreshToken: string; employee: Employee }>(
      "/api/auth/login",
      { email, password }
    );
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.employee);
  }, []);

  const register = useCallback(
    async (input: { fullName: string; email: string; password: string; phone?: string; jobTitle?: string }) => {
      const { data } = await api.post<{ accessToken: string; refreshToken: string; employee: Employee }>(
        "/api/auth/register",
        input
      );
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.employee);
    },
    []
  );

  const logout = useCallback(async () => {
    const rt = localStorage.getItem("syt_refresh");
    try {
      if (rt) await api.post("/api/auth/logout", { refreshToken: rt });
    } catch {
      /* ignore */
    }
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshMe,
    }),
    [user, loading, login, register, logout, refreshMe]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const x = useContext(Ctx);
  if (!x) throw new Error("useAuth");
  return x;
}

export function useRole(): Role | null {
  return useAuth().user?.role ?? null;
}
