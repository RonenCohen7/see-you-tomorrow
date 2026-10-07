import * as SecureStore from "expo-secure-store";

const ACCESS = "syt.access";
const REFRESH = "syt.refresh";
const API_URL = "syt.apiUrl";

const storeOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

export async function readAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS);
}

export async function readRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH);
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS, accessToken, storeOptions);
  await SecureStore.setItemAsync(REFRESH, refreshToken, storeOptions);
}

async function remove(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* missing keys are already gone */
  }
}

export async function clearTokens(): Promise<void> {
  await remove(ACCESS);
  await remove(REFRESH);
}

export function bundledApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  return (fromEnv || "http://127.0.0.1:4000").replace(/\/$/, "");
}

function lanHost(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return host;
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export async function readApiUrl(): Promise<string> {
  const bundled = bundledApiUrl();
  const saved = (await SecureStore.getItemAsync(API_URL))?.trim().replace(/\/$/, "");
  if (!saved || saved === bundled) return bundled;
  const savedHost = lanHost(saved);
  if (savedHost && savedHost !== lanHost(bundled)) {
    await remove(API_URL);
    return bundled;
  }
  return saved;
}

export async function saveApiUrl(url: string): Promise<void> {
  const trimmed = url.trim().replace(/\/$/, "");
  if (!trimmed || trimmed === bundledApiUrl()) {
    await remove(API_URL);
    return;
  }
  await SecureStore.setItemAsync(API_URL, trimmed, storeOptions);
}
