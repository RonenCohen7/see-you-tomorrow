import { PLATFORM_DB } from "../config/dbNames.js";
import { getConnection } from "../utils/mongo.js";
import {
  getTenantEmailMembershipModel,
  type TenantEmailMembershipDoc,
} from "../models/tenantEmailMembership.js";
import { getTenantInviteModel } from "../models/tenantInvite.js";
import {
  getTenantRegistryModel,
  type TenantRegistryDoc,
  type TenantStatus,
} from "../models/tenantRegistry.js";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  return email.slice(at + 1).toLowerCase();
}

async function platformConn() {
  return getConnection(PLATFORM_DB);
}

export async function upsertTenantRegistry(input: {
  slug: string;
  name: string;
  dbPrefix: string;
  emailDomains?: string[];
  subdomain: string;
  authServiceUrl: string;
  gatewayUrl: string;
  status?: TenantStatus;
}): Promise<TenantRegistryDoc> {
  const conn = await platformConn();
  const TenantRegistry = getTenantRegistryModel(conn);
  const slug = input.slug.trim().toLowerCase();
  const dbPrefix = input.dbPrefix.endsWith("_") ? input.dbPrefix : `${input.dbPrefix}_`;
  const doc = await TenantRegistry.findOneAndUpdate(
    { slug },
    {
      $set: {
        name: input.name.trim(),
        dbPrefix,
        emailDomains: (input.emailDomains ?? []).map((d) => d.trim().toLowerCase()).filter(Boolean),
        subdomain: input.subdomain.trim().toLowerCase(),
        authServiceUrl: input.authServiceUrl.trim(),
        gatewayUrl: input.gatewayUrl.trim(),
        status: input.status ?? "active",
      },
    },
    { upsert: true, new: true }
  ).lean();
  return doc as TenantRegistryDoc;
}

export async function getTenantBySlug(slug: string): Promise<TenantRegistryDoc | null> {
  const conn = await platformConn();
  const TenantRegistry = getTenantRegistryModel(conn);
  return TenantRegistry.findOne({ slug: slug.trim().toLowerCase(), status: "active" }).lean();
}

export async function findTenantsByEmailDomain(domain: string): Promise<TenantRegistryDoc[]> {
  const conn = await platformConn();
  const TenantRegistry = getTenantRegistryModel(conn);
  const d = domain.trim().toLowerCase();
  return TenantRegistry.find({ emailDomains: d, status: "active" }).lean();
}

export async function syncEmailMembership(input: {
  email: string;
  tenantSlug: string;
  isActive: boolean;
}): Promise<void> {
  const slug = process.env.TENANT_SLUG?.trim().toLowerCase();
  const tenantSlug = (input.tenantSlug || slug || "").trim().toLowerCase();
  if (!tenantSlug) return;

  const conn = await platformConn();
  const Membership = getTenantEmailMembershipModel(conn);
  const email = normalizeEmail(input.email);
  await Membership.findOneAndUpdate(
    { email, tenantSlug },
    { $set: { isActive: input.isActive } },
    { upsert: true }
  );
}

export async function removeEmailMembership(email: string, tenantSlug?: string): Promise<void> {
  const slug = (tenantSlug ?? process.env.TENANT_SLUG ?? "").trim().toLowerCase();
  if (!slug) return;
  const conn = await platformConn();
  const Membership = getTenantEmailMembershipModel(conn);
  await Membership.deleteOne({ email: normalizeEmail(email), tenantSlug: slug });
}

export async function findActiveMemberships(email: string): Promise<TenantEmailMembershipDoc[]> {
  const conn = await platformConn();
  const Membership = getTenantEmailMembershipModel(conn);
  return Membership.find({ email: normalizeEmail(email), isActive: true }).lean();
}

export async function resolveTenantsForAuth(input: {
  email: string;
  tenantSlug?: string;
  inviteToken?: string;
}): Promise<TenantRegistryDoc[]> {
  const email = normalizeEmail(input.email);

  if (input.inviteToken?.trim()) {
    const conn = await platformConn();
    const Invite = getTenantInviteModel(conn);
    const invite = await Invite.findOne({
      token: input.inviteToken.trim(),
      email,
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!invite) return [];
    const tenant = await getTenantBySlug(invite.tenantSlug);
    return tenant ? [tenant] : [];
  }

  if (input.tenantSlug?.trim()) {
    const tenant = await getTenantBySlug(input.tenantSlug.trim());
    return tenant ? [tenant] : [];
  }

  const domain = emailDomain(email);
  if (domain) {
    const byDomain = await findTenantsByEmailDomain(domain);
    if (byDomain.length === 1) {
      return filterTenantsByActiveMembership(email, byDomain);
    }
    if (byDomain.length > 1) {
      return filterTenantsByActiveMembership(email, byDomain);
    }
  }

  const memberships = await findActiveMemberships(email);
  if (memberships.length === 0) return [];

  const tenants: TenantRegistryDoc[] = [];
  for (const m of memberships) {
    const t = await getTenantBySlug(m.tenantSlug);
    if (t) tenants.push(t);
  }
  return tenants;
}

async function filterTenantsByActiveMembership(
  email: string,
  tenants: TenantRegistryDoc[]
): Promise<TenantRegistryDoc[]> {
  const memberships = await findActiveMemberships(email);
  if (memberships.length === 0) {
    // No platform index yet — tenant auth-service still enforces isActive.
    return tenants;
  }
  const activeSlugs = new Set(memberships.map((m) => m.tenantSlug));
  const filtered = tenants.filter((t) => activeSlugs.has(t.slug));
  return filtered;
}

export async function markInviteUsed(token: string): Promise<void> {
  const conn = await platformConn();
  const Invite = getTenantInviteModel(conn);
  await Invite.updateOne({ token }, { $set: { usedAt: new Date() } });
}

export async function createTenantInvite(input: {
  tenantSlug: string;
  email: string;
  token: string;
  expiresAt: Date;
}): Promise<void> {
  const conn = await platformConn();
  const Invite = getTenantInviteModel(conn);
  await Invite.create({
    token: input.token,
    tenantSlug: input.tenantSlug.trim().toLowerCase(),
    email: normalizeEmail(input.email),
    expiresAt: input.expiresAt,
  });
}
