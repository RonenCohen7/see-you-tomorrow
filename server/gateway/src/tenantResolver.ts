import type { Request, Response, NextFunction } from "express";
import {
  AppError,
  markInviteUsed,
  resolveTenantsForAuth,
  type TenantRegistryDoc,
} from "@syt/shared";

export type AuthBody = {
  email?: string;
  tenantSlug?: string;
  inviteToken?: string;
  [key: string]: unknown;
};

function readAuthBody(req: Request): AuthBody {
  return (req.body ?? {}) as AuthBody;
}

export async function resolveAuthTenant(req: Request): Promise<TenantRegistryDoc> {
  const body = readAuthBody(req);
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    throw new AppError(400, "נדרש אימייל", "EMAIL_REQUIRED");
  }

  const tenants = await resolveTenantsForAuth({
    email,
    tenantSlug: typeof body.tenantSlug === "string" ? body.tenantSlug : undefined,
    inviteToken: typeof body.inviteToken === "string" ? body.inviteToken : undefined,
  });

  if (tenants.length === 0) {
    throw new AppError(
      404,
      "לא נמצאה חברה פעילה עבור האימייל. נסו קוד חברה או קישור הזמנה.",
      "TENANT_NOT_FOUND"
    );
  }

  if (tenants.length > 1) {
    throw new AppError(409, "האימייל משויך למספר חברות — בחרו קוד חברה", "TENANT_AMBIGUOUS", {
      tenants: tenants.map((t) => ({ slug: t.slug, name: t.name, gatewayUrl: t.gatewayUrl })),
    });
  }

  return tenants[0]!;
}

export async function forwardAuthRequest(
  req: Request,
  res: Response,
  targetBase: string,
  pathSuffix: string,
  tenant?: TenantRegistryDoc
): Promise<void> {
  const url = `${targetBase.replace(/\/$/, "")}/api/auth${pathSuffix}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const auth = req.headers.authorization;
  if (typeof auth === "string") headers.Authorization = auth;

  const init: RequestInit = {
    method: req.method,
    headers,
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = JSON.stringify(req.body ?? {});
  }

  const upstream = await fetch(url, init);
  const text = await upstream.text();
  res.status(upstream.status);
  const ct = upstream.headers.get("content-type");
  if (ct) res.setHeader("Content-Type", ct);

  if (tenant && upstream.ok && ct?.includes("json")) {
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      json.tenant = {
        slug: tenant.slug,
        name: tenant.name,
        gatewayUrl: tenant.gatewayUrl,
        subdomain: tenant.subdomain,
      };
      res.send(JSON.stringify(json));
      return;
    } catch {
      // fall through
    }
  }

  res.send(text);
}

export function centralAuthProxy(pathSuffix: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = await resolveAuthTenant(req);
      const body = readAuthBody(req);

      if (pathSuffix === "/register" && typeof body.inviteToken === "string" && body.inviteToken.trim()) {
        await forwardAuthRequest(req, res, tenant.authServiceUrl, pathSuffix, tenant);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          await markInviteUsed(body.inviteToken.trim());
        }
        return;
      }

      await forwardAuthRequest(req, res, tenant.authServiceUrl, pathSuffix, tenant);
    } catch (e) {
      next(e);
    }
  };
}

export function isCentralGatewayMode(): boolean {
  return (process.env.GATEWAY_MODE ?? "").trim().toLowerCase() === "central";
}

export function tenantSlugFromHost(hostname: string): string | null {
  const base = (process.env.TENANT_BASE_DOMAIN ?? "").trim().toLowerCase();
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  if (!base || !host.endsWith(`.${base}`)) return null;
  const sub = host.slice(0, -(base.length + 1));
  if (!sub || sub.includes(".")) return null;
  return sub;
}
