import { AsyncLocalStorage } from "node:async_hooks";

type Store = { slug: string };

const als = new AsyncLocalStorage<Store>();

/** One shared process, many companies. Each request selects `{slug}_syt_*` databases. */
export function isSharedSaasMode(): boolean {
  return (process.env.SAAS_MODE ?? "").trim().toLowerCase() === "shared";
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

const RESERVED_SLUGS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "static",
  "platform",
  "syt",
  "login",
  "register",
  "support",
  "cdn",
  "status",
]);

export function normalizeTenantSlug(raw: string): string | null {
  const slug = raw.trim().toLowerCase();
  if (!SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) return null;
  return slug;
}

export function getRequestTenantSlug(): string | null {
  return als.getStore()?.slug ?? null;
}

/** Run `fn` with Mongo database prefix = slug. Empty slug keeps the ambient prefix (env / none). */
export function runWithTenant<T>(slug: string | null | undefined, fn: () => T): T {
  const clean = slug?.trim().toLowerCase();
  if (!clean) return fn();
  return als.run({ slug: clean }, fn);
}
