import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Types } from "mongoose";
import jwt from "jsonwebtoken";
import {
  DB_NAMES,
  getConnection,
  getDepartmentModel,
  getEmployeeModel,
  getRefreshTokenModel,
  getJwtSecret,
  signAccessToken,
  signRefreshToken,
  AppError,
  type Role,
  deleteTenantBySlug,
  ensureTenantDatabases,
  getRequestTenantSlug,
  insertTenantRegistry,
  isSharedSaasMode,
  listCompanyCodesInRange,
  pickCompanyCode,
  runWithTenant,
  syncEmailMembership,
} from "@syt/shared";
import type { EmployeeDoc } from "@syt/shared";
import * as notificationClient from "./notificationClient.js";
import { logger } from "@syt/shared";

function hashRefresh(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function departmentModel() {
  return getDepartmentModel(await getConnection(DB_NAMES.departments));
}

/** Public picker for the registration form (names only). */
export async function listRegistrationDepartments() {
  const Department = await departmentModel();
  const rows = await Department.find({ isActive: true }).select("name").sort({ name: 1 }).lean();
  return rows.map((d) => ({ id: d._id.toString(), name: d.name }));
}

/** Joining employees must pick an existing active department whenever the company has any. */
async function resolveRegistrationDepartment(
  departmentId: string | undefined,
  role: Role
): Promise<Types.ObjectId | undefined> {
  const Department = await departmentModel();
  if (departmentId) {
    const dept = await Department.findOne({ _id: departmentId, isActive: true }).select("_id").lean();
    if (!dept) throw new AppError(400, "המחלקה שנבחרה לא קיימת או אינה פעילה", "DEPARTMENT_INVALID");
    return dept._id;
  }
  if (role !== "admin" && (await Department.exists({ isActive: true }))) {
    throw new AppError(400, "יש לבחור מחלקה", "DEPARTMENT_REQUIRED");
  }
  return undefined;
}

export async function registerEmployee(input: {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  jobTitle?: string;
  departmentId?: string;
}) {
  const empConn = await getConnection(DB_NAMES.employees);
  const Employee = getEmployeeModel(empConn);
  const count = await Employee.countDocuments();
  const role: Role = count === 0 ? "admin" : "employee";

  const exists = await Employee.findOne({ email: input.email.toLowerCase() });
  if (exists) throw new AppError(409, "כתובת האימייל כבר רשומה", "EMAIL_EXISTS");

  const departmentId = await resolveRegistrationDepartment(input.departmentId, role);

  const hashed = await bcrypt.hash(input.password, 12);
  const doc = await Employee.create({
    fullName: input.fullName,
    email: input.email.toLowerCase(),
    password: hashed,
    phone: input.phone,
    jobTitle: input.jobTitle,
    departmentId,
    role,
    isActive: true,
  });

  const tenantSlug = getRequestTenantSlug() || process.env.TENANT_SLUG?.trim();
  if (tenantSlug) {
    try {
      await syncEmailMembership({ email: doc.email, tenantSlug, isActive: true });
    } catch {
      /* platform DB optional in dev */
    }
  }

  const tokens = await issueTokensForUser(doc._id as Types.ObjectId, doc.email, doc.role);
  return { employee: toPublic(doc), ...tokens };
}

export async function login(input: { email: string; password: string }) {
  const empConn = await getConnection(DB_NAMES.employees);
  const Employee = getEmployeeModel(empConn);
  const doc = await Employee.findOne({ email: input.email.toLowerCase() }).select("+password");
  if (!doc || !doc.isActive) {
    throw new AppError(401, "אימייל או סיסמה שגויים", "INVALID_CREDENTIALS");
  }
  const ok = await bcrypt.compare(input.password, doc.password);
  if (!ok) throw new AppError(401, "אימייל או סיסמה שגויים", "INVALID_CREDENTIALS");

  const tokens = await issueTokensForUser(doc._id as Types.ObjectId, doc.email, doc.role);
  return { employee: toPublic(doc), ...tokens };
}

function currentTenantSlug(): string | undefined {
  return getRequestTenantSlug() || process.env.TENANT_SLUG?.trim().toLowerCase() || undefined;
}

async function issueTokensForUser(userId: Types.ObjectId, email: string, role: Role) {
  const tenant = currentTenantSlug();
  if (isSharedSaasMode() && !tenant) {
    throw new AppError(400, "חסר זיהוי חברה", "TENANT_REQUIRED");
  }
  const accessToken = signAccessToken({
    sub: userId.toString(),
    email,
    role,
    tenant,
  });
  const refreshRaw = signRefreshToken(userId.toString(), role, email, tenant);
  const tokenHash = hashRefresh(refreshRaw);

  const authConn = await getConnection(DB_NAMES.auth);
  const RefreshToken = getRefreshTokenModel(authConn);
  const decoded = jwt.decode(refreshRaw) as { exp?: number };
  const expiresAt = decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 864e5);

  await RefreshToken.create({
    tokenHash,
    userId,
    expiresAt,
  });

  return { accessToken, refreshToken: refreshRaw };
}

export async function logout(refreshToken: string) {
  const authConn = await getConnection(DB_NAMES.auth);
  const RefreshToken = getRefreshTokenModel(authConn);
  const tokenHash = hashRefresh(refreshToken);
  await RefreshToken.deleteOne({ tokenHash });
}

export async function refresh(refreshToken: string) {
  let payload: { sub?: string; role?: Role; email?: string; typ?: string; tenant?: string };
  try {
    payload = jwt.verify(refreshToken, getJwtSecret()) as typeof payload;
  } catch {
    throw new AppError(401, "אסימון רענון לא תקין", "INVALID_REFRESH");
  }
  if (payload.typ !== "refresh" || !payload.sub || !payload.email || !payload.role) {
    throw new AppError(401, "אסימון רענון לא תקין", "INVALID_REFRESH");
  }
  const ctx = currentTenantSlug();
  const tokenTenant = typeof payload.tenant === "string" ? payload.tenant : undefined;
  if (isSharedSaasMode() && (!tokenTenant || (ctx && tokenTenant !== ctx))) {
    throw new AppError(401, "אסימון רענון לא שייך לחברה הזו", "INVALID_REFRESH");
  }

  const authConn = await getConnection(DB_NAMES.auth);
  const RefreshToken = getRefreshTokenModel(authConn);
  const tokenHash = hashRefresh(refreshToken);
  const existing = await RefreshToken.findOne({ tokenHash });
  if (!existing) throw new AppError(401, "אסימון רענון בוטל או פג תוקף", "REFRESH_REVOKED");

  await RefreshToken.deleteOne({ _id: existing._id });

  const empConn = await getConnection(DB_NAMES.employees);
  const Employee = getEmployeeModel(empConn);
  const user = await Employee.findById(payload.sub);
  if (!user?.isActive) throw new AppError(401, "המשתמש לא פעיל", "INACTIVE");

  const tokens = await issueTokensForUser(user._id as Types.ObjectId, user.email, user.role);
  return { employee: toPublic(user), ...tokens };
}

export async function getProfile(userId: string) {
  const empConn = await getConnection(DB_NAMES.employees);
  const Employee = getEmployeeModel(empConn);
  const doc = await Employee.findById(userId);
  if (!doc) throw new AppError(404, "משתמש לא נמצא", "NOT_FOUND");
  return toPublic(doc);
}

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "walla.co.il",
  "walla.com",
]);

export async function registerOrganization(input: {
  organizationName: string;
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  jobTitle?: string;
  locale?: "he" | "en";
}) {
  if (!isSharedSaasMode()) {
    throw new AppError(
      400,
      "הרשמת ארגון זמינה כשהשרת רץ במצב SaaS משותף (SAAS_MODE=shared).",
      "SAAS_MODE_REQUIRED"
    );
  }

  const email = input.email.trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";
  const emailDomains = domain && !PERSONAL_EMAIL_DOMAINS.has(domain) ? [domain] : [];
  const gatewayUrl = (
    process.env.PUBLIC_APP_URL ??
    process.env.CORS_ORIGIN?.split(",")[0] ??
    "http://localhost:5173"
  ).replace(/\/$/, "");
  const authServiceUrl = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";
  const name = input.organizationName.trim();

  let slug = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    const taken = await listCompanyCodesInRange();
    const code = pickCompanyCode(taken);
    if (!code) {
      throw new AppError(503, "אין כרגע קודי חברה פנויים. פנו לתמיכה.", "COMPANY_CODES_EXHAUSTED");
    }
    const reserved = await insertTenantRegistry({
      slug: code,
      name,
      dbPrefix: code,
      emailDomains,
      subdomain: code,
      authServiceUrl,
      gatewayUrl,
    });
    if (reserved) {
      slug = code;
      break;
    }
  }
  if (!slug) {
    throw new AppError(503, "לא הצלחנו להקצות קוד חברה. נסו שוב.", "COMPANY_CODE_RETRY");
  }

  try {
    const result = await runWithTenant(slug, async () => {
      await ensureTenantDatabases();
      return registerEmployee({
        fullName: input.fullName,
        email,
        password: input.password,
        phone: input.phone,
        jobTitle: input.jobTitle,
      });
    });

    let welcomeEmailSent = false;
    try {
      await notificationClient.sendWelcomeCompanyEmail({
        to: email,
        fullName: input.fullName.trim(),
        organizationName: name,
        companyCode: slug,
        loginUrl: `${gatewayUrl}/login`,
        locale: input.locale === "en" ? "en" : "he",
      });
      welcomeEmailSent = true;
    } catch (e) {
      logger.warn("welcome company email failed", e instanceof Error ? e.message : undefined);
    }

    return {
      ...result,
      welcomeEmailSent,
      tenant: { slug, name, gatewayUrl, subdomain: slug },
    };
  } catch (e) {
    await deleteTenantBySlug(slug).catch(() => undefined);
    throw e;
  }
}

function toPublic(doc: EmployeeDoc) {
  return {
    id: doc._id.toString(),
    fullName: doc.fullName,
    email: doc.email,
    phone: doc.phone,
    imageUrl: doc.imageUrl,
    jobTitle: doc.jobTitle,
    departmentId: doc.departmentId?.toString(),
    locationId: doc.locationId?.toString(),
    managerId: doc.managerId?.toString(),
    role: doc.role,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

