import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";

const baseURL = import.meta.env.VITE_API_BASE ?? "";
/** Allow slow first Mongo connection / cold Docker; override with VITE_API_TIMEOUT_MS */
const defaultTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 45_000;

const bare = axios.create({
  baseURL,
  timeout: defaultTimeout,
});

const api = axios.create({
  baseURL,
  withCredentials: false,
  timeout: defaultTimeout,
});

const ACCESS = "syt_access";
const REFRESH = "syt_refresh";

export function getAccessToken() {
  return localStorage.getItem(ACCESS);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS, access);
  localStorage.setItem(REFRESH, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
}

api.interceptors.request.use((config) => {
  const t = getAccessToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

let refreshing = false;

/** Do not run refresh-token flow on credential-based auth calls — a failed login returns 401 too. */
function isPublicAuthRequest(config: InternalAxiosRequestConfig | undefined): boolean {
  const u = config?.url ?? "";
  return (
    u.includes("/api/auth/login") ||
    u.includes("/api/auth/register") ||
    u.includes("/api/auth/refresh")
  );
}

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (!original) return Promise.reject(err);
    if (err.response?.status === 401 && isPublicAuthRequest(original)) {
      return Promise.reject(err);
    }
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }
    original._retry = true;
    const rt = localStorage.getItem(REFRESH);
    if (!rt) return Promise.reject(err);
    if (refreshing) return Promise.reject(err);
    refreshing = true;
    try {
      const { data } = await bare.post<{ accessToken: string; refreshToken: string }>(
        "/api/auth/refresh",
        { refreshToken: rt }
      );
      setTokens(data.accessToken, data.refreshToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch {
      clearTokens();
      window.dispatchEvent(new Event("syt-auth"));
      return Promise.reject(err);
    } finally {
      refreshing = false;
    }
  }
);

export default api;
