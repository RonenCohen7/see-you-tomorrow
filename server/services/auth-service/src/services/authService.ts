import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Types } from "mongoose";
import jwt from "jsonwebtoken";
import {
  DB_NAMES,
  getConnection,
  getEmployeeModel,
  getRefreshTokenModel,
  getJwtSecret,
  signAccessToken,
  signRefreshToken,
  AppError,
  type Role,
  syncEmailMembership,
} from "@syt/shared";
import type { EmployeeDoc } from "@syt/shared";

function hashRefresh(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function registerEmployee(input: {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  jobTitle?: string;
}) {
  const empConn = await getConnection(DB_NAMES.employees);
  const Employee = getEmployeeModel(empConn);
  const count = await Employee.countDocuments();
  const role: Role = count === 0 ? "admin" : "employee";

  const exists = await Employee.findOne({ email: input.email.toLowerCase() });
  if (exists) throw new AppError(409, "כתובת האימייל כבר רשומה", "EMAIL_EXISTS");

  const hashed = await bcrypt.hash(input.password, 12);
  const doc = await Employee.create({
    fullName: input.fullName,
    email: input.email.toLowerCase(),
    password: hashed,
    phone: input.phone,
    jobTitle: input.jobTitle,
    role,
    isActive: true,
  });

  const tenantSlug = process.env.TENANT_SLUG?.trim();
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

async function issueTokensForUser(userId: Types.ObjectId, email: string, role: Role) {
  const accessToken = signAccessToken({
    sub: userId.toString(),
    email,
    role,
  });
  const refreshRaw = signRefreshToken(userId.toString(), role, email);
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
  let payload: { sub?: string; role?: Role; email?: string; typ?: string };
  try {
    payload = jwt.verify(refreshToken, getJwtSecret()) as typeof payload;
  } catch {
    throw new AppError(401, "אסימון רענון לא תקין", "INVALID_REFRESH");
  }
  if (payload.typ !== "refresh" || !payload.sub || !payload.email || !payload.role) {
    throw new AppError(401, "אסימון רענון לא תקין", "INVALID_REFRESH");
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

