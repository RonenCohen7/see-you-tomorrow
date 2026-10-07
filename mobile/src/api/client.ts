import { clearTokens, readAccessToken, readApiUrl, readRefreshToken, saveTokens } from "./session";

export type Employee = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  role: "admin" | "manager" | "employee";
  locationId?: string;
  departmentId?: string;
  isActive: boolean;
};

export type AuthResult = {
  accessToken: string;
  refreshToken: string;
  employee: Employee;
};

type ApiErrorBody = {
  error?: string;
  code?: string;
  details?: { fieldErrors?: Record<string, string[]> };
};

const BIDI = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export function cleanLoginEmail(raw: string): string {
  return raw.replace(BIDI, "").replace(/\s+/g, "").trim().toLowerCase();
}

export function cleanSecret(raw: string): string {
  return raw.replace(BIDI, "").trim();
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let message = "שגיאת שרת";
  let code: string | undefined;
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body.code === "VALIDATION" && body.details?.fieldErrors?.email?.length) {
      message = "האימייל לא תקין. הקלידו את הכתובת באנגלית, כמו באתר.";
    } else if (body.code === "VALIDATION" && body.details?.fieldErrors?.password?.length) {
      message = "חסרה סיסמה.";
    } else if (body.error) {
      message = body.error;
    }
    code = body.code;
  } catch {
    /* non-JSON body */
  }
  return new ApiError(response.status, message, code);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) return null;
  const base = await readApiUrl();
  const response = await fetch(`${base}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    await clearTokens();
    return null;
  }
  const data = (await response.json()) as { accessToken?: string; refreshToken?: string };
  if (!data.accessToken || !data.refreshToken) {
    await clearTokens();
    return null;
  }
  await saveTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

export async function api<T>(
  path: string,
  options?: { method?: string; body?: unknown; auth?: boolean }
): Promise<T> {
  const method = options?.method ?? "GET";
  const auth = options?.auth ?? true;
  const base = await readApiUrl();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options?.body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = await readAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const send = () =>
    fetch(`${base}${path}`, {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let response: Response;
  try {
    response = await send();
  } catch {
    throw new ApiError(0, "אין חיבור לשרת. בדקו שהמערכת רצה ושהטלפון באותה רשת.");
  }

  if (response.status === 401 && auth) {
    const next = await refreshAccessToken();
    if (next) {
      headers.Authorization = `Bearer ${next}`;
      try {
        response = await send();
      } catch {
        throw new ApiError(0, "אין חיבור לשרת. בדקו שהמערכת רצה ושהטלפון באותה רשת.");
      }
    }
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function loginRequest(input: {
  email: string;
  password: string;
  tenantSlug?: string;
}): Promise<AuthResult> {
  const body: Record<string, string> = {
    email: cleanLoginEmail(input.email),
    password: cleanSecret(input.password),
  };
  if (input.tenantSlug?.trim()) body.tenantSlug = input.tenantSlug.trim();
  return api<AuthResult>("/api/auth/login", { method: "POST", body, auth: false });
}

export async function meRequest(): Promise<Employee> {
  return api<Employee>("/api/auth/me");
}

export async function supportChatRequest(
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<{ reply: string }> {
  return api("/api/ai/support/chat", {
    method: "POST",
    auth: false,
    body: { messages, locale: "he" },
  });
}

export async function logoutRequest(): Promise<void> {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) return;
  try {
    await api("/api/auth/logout", { method: "POST", body: { refreshToken }, auth: false });
  } catch {
    /* local sign-out still proceeds */
  }
}
