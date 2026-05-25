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
import { redirectToTenantGateway, type TenantRedirectInfo } from "../utils/tenantAuth";

type AuthState = {
  user: Employee | null;
  loading: boolean;
};

type LoginOptions = {
  turnstileToken?: string | null;
  tenantSlug?: string;
  inviteToken?: string;
};

type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  employee: Employee;
  tenant?: TenantRedirectInfo;
};

type AuthCtx = AuthState & {
  login: (email: string, password: string, options?: LoginOptions) => Promise<Employee | "redirect">;
  register: (input: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    jobTitle?: string;
    turnstileToken?: string | null;
    tenantSlug?: string;
    inviteToken?: string;
  }) => Promise<Employee | "redirect">;
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

  const login = useCallback(async (email: string, password: string, options?: LoginOptions) => {
    clearTokens();
    const body: Record<string, string> = { email, password };
    if (options?.turnstileToken) body.turnstileToken = options.turnstileToken;
    if (options?.tenantSlug?.trim()) body.tenantSlug = options.tenantSlug.trim();
    if (options?.inviteToken?.trim()) body.inviteToken = options.inviteToken.trim();
    const { data } = await api.post<AuthTokensResponse>("/api/auth/login", body);
    if (
      data.tenant &&
      redirectToTenantGateway(data.tenant, {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      })
    ) {
      return "redirect";
    }
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.employee);
    return data.employee;
  }, []);

  const register = useCallback(
    async (input: {
      fullName: string;
      email: string;
      password: string;
      phone?: string;
      jobTitle?: string;
      turnstileToken?: string | null;
      tenantSlug?: string;
      inviteToken?: string;
    }) => {
      const { turnstileToken, tenantSlug, inviteToken, ...rest } = input;
      const body: Record<string, string> = { ...rest };
      if (turnstileToken) body.turnstileToken = turnstileToken;
      if (tenantSlug?.trim()) body.tenantSlug = tenantSlug.trim();
      if (inviteToken?.trim()) body.inviteToken = inviteToken.trim();
      const { data } = await api.post<AuthTokensResponse>("/api/auth/register", body);
      if (
        data.tenant &&
        redirectToTenantGateway(data.tenant, {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        })
      ) {
        return "redirect";
      }
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.employee);
      return data.employee;
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
