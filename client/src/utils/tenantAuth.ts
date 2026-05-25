export type TenantRedirectInfo = {
  slug: string;
  name: string;
  gatewayUrl: string;
  subdomain?: string;
};

export function isCentralLoginEnabled(): boolean {
  return import.meta.env.VITE_CENTRAL_LOGIN === "true";
}

/** Hand off tokens to tenant subdomain after central-gateway login. */
export function redirectToTenantGateway(
  tenant: TenantRedirectInfo,
  tokens: { accessToken: string; refreshToken: string }
): boolean {
  if (!tenant.gatewayUrl?.trim()) return false;
  try {
    const target = new URL(tenant.gatewayUrl);
    if (target.origin === window.location.origin) return false;
    const hash = new URLSearchParams({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    }).toString();
    window.location.assign(`${target.origin}/login/callback#${hash}`);
    return true;
  } catch {
    return false;
  }
}

export function applyTokensFromCallbackHash(): { accessToken: string; refreshToken: string } | null {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const accessToken = params.get("accessToken");
  const refreshToken = params.get("refreshToken");
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}
