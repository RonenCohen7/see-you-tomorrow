/**
 * Provision a new SaaS tenant: create prefixed MongoDB databases and register in syt_platform.
 *
 * Usage:
 *   npm run build -w @syt/shared
 *   tsx server/scripts/provision-tenant.ts --slug acme --name "Acme Ltd" \
 *     --email-domains acme.co.il,acme.com \
 *     --gateway-url https://acme.example.com \
 *     --auth-url http://auth-acme:4001
 *
 * Optional invite:
 *   --invite-email user@gmail.com
 */
import "dotenv/config";
import crypto from "crypto";
import mongoose from "mongoose";
import {
  DB_NAMES,
  PLATFORM_DB,
  createTenantInvite,
  getConnection,
  getOrganizationSettingsModel,
  syncEmailMembership,
  upsertTenantRegistry,
} from "../shared/src/index.ts";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function requireArg(name: string): string {
  const v = arg(name);
  if (!v?.trim()) {
    console.error(`Missing required --${name}`);
    process.exit(1);
  }
  return v.trim();
}

async function touchTenantDatabases(dbPrefix: string) {
  process.env.TENANT_DB_PREFIX = dbPrefix.endsWith("_") ? dbPrefix.slice(0, -1) : dbPrefix;

  const names = [
    DB_NAMES.auth,
    DB_NAMES.employees,
    DB_NAMES.departments,
    DB_NAMES.locations,
    DB_NAMES.schedules,
    DB_NAMES.notifications,
    DB_NAMES.settings,
  ];

  for (const dbName of names) {
    const conn = await getConnection(dbName);
    await conn.db.createCollection("_tenant_init");
    console.log(`  DB ready: ${dbName}`);
  }

  const setConn = await getConnection(DB_NAMES.settings);
  const OrgSettings = getOrganizationSettingsModel(setConn);
  const existing = await OrgSettings.findOne().lean();
  if (!existing) {
    await OrgSettings.create({});
    console.log("  OrganizationSettings initialized");
  }
}

async function main() {
  const slug = requireArg("slug");
  const name = requireArg("name");
  const gatewayUrl = requireArg("gateway-url");
  const authUrl = requireArg("auth-url");
  const emailDomainsRaw = arg("email-domains") ?? "";
  const emailDomains = emailDomainsRaw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  const dbPrefix = `${slug}_`;
  const subdomain = slug.toLowerCase();

  console.log(`Provisioning tenant "${slug}"…`);
  await touchTenantDatabases(dbPrefix);

  await upsertTenantRegistry({
    slug,
    name,
    dbPrefix,
    emailDomains,
    subdomain,
    authServiceUrl: authUrl,
    gatewayUrl,
    status: "active",
  });
  console.log(`Registered in ${PLATFORM_DB}.TenantRegistry`);

  const inviteEmail = arg("invite-email");
  if (inviteEmail?.trim()) {
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 864e5);
    await createTenantInvite({ tenantSlug: slug, email: inviteEmail.trim(), token, expiresAt });
    process.env.TENANT_SLUG = slug;
    await syncEmailMembership({ email: inviteEmail.trim(), tenantSlug: slug, isActive: true });
    const inviteLink = `${gatewayUrl.replace(/\/$/, "")}/register?invite=${token}&email=${encodeURIComponent(inviteEmail.trim())}`;
    console.log(`Invite link: ${inviteLink}`);
  }

  console.log("Done.");
  console.log(`  Subdomain login: ${gatewayUrl}`);
  console.log(`  TENANT_DB_PREFIX=${dbPrefix}`);
  console.log(`  TENANT_SLUG=${slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
