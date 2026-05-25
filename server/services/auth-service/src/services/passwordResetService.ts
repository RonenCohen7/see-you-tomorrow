import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Types } from "mongoose";
import {
  AppError,
  DB_NAMES,
  getConnection,
  getEmployeeModel,
  getPasswordResetTokenModel,
  getRefreshTokenModel,
  logger,
} from "@syt/shared";
import { publicAppBaseUrl } from "../config/urls.js";
import * as notificationClient from "./notificationClient.js";

const RESET_TTL_MS = Number(process.env.PASSWORD_RESET_TTL_MS ?? 60 * 60 * 1000);

function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function requestPasswordReset(email: string, locale: "he" | "en" = "he") {
  const normalized = email.trim().toLowerCase();
  const empConn = await getConnection(DB_NAMES.employees);
  const Employee = getEmployeeModel(empConn);
  const doc = await Employee.findOne({ email: normalized, isActive: true });

  if (!doc) {
    logger.info("password reset requested for unknown/inactive email", { email: normalized });
    return { ok: true as const };
  }

  const authConn = await getConnection(DB_NAMES.auth);
  const PasswordResetToken = getPasswordResetTokenModel(authConn);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await PasswordResetToken.countDocuments({
    userId: doc._id,
    createdAt: { $gte: hourAgo },
  });
  if (recentCount >= 3) {
    logger.warn("password reset per-email rate limit", { email: normalized });
    return { ok: true as const };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await PasswordResetToken.deleteMany({ userId: doc._id, usedAt: { $exists: false } });
  await PasswordResetToken.create({
    tokenHash,
    userId: doc._id,
    expiresAt,
  });

  const resetUrl = `${publicAppBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;

  try {
    await notificationClient.sendPasswordResetEmail({
      to: doc.email,
      fullName: doc.fullName,
      resetUrl,
      locale,
    });
  } catch (e) {
    await PasswordResetToken.deleteOne({ tokenHash });
    logger.error("password reset email send failed", e instanceof Error ? e : undefined);
    throw new AppError(503, "לא ניתן לשלוח מייל כעת. נסה שוב מאוחר יותר.", "EMAIL_SEND_FAILED");
  }

  logger.info("password reset email queued", { userId: doc._id.toString(), email: normalized });
  return { ok: true as const };
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const raw = token.trim();
  if (!raw) throw new AppError(400, "קישור איפוס לא תקין", "INVALID_TOKEN");

  const tokenHash = hashToken(raw);
  const authConn = await getConnection(DB_NAMES.auth);
  const PasswordResetToken = getPasswordResetTokenModel(authConn);
  const RefreshToken = getRefreshTokenModel(authConn);

  const row = await PasswordResetToken.findOne({ tokenHash });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    throw new AppError(400, "קישור האיפוס פג תוקף או כבר נוצל. בקש קישור חדש.", "INVALID_TOKEN");
  }

  const empConn = await getConnection(DB_NAMES.employees);
  const Employee = getEmployeeModel(empConn);
  const user = await Employee.findById(row.userId);
  if (!user?.isActive) {
    throw new AppError(400, "קישור האיפוס לא תקין", "INVALID_TOKEN");
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  user.password = hashed;
  await user.save();

  row.usedAt = new Date();
  await row.save();

  await PasswordResetToken.deleteMany({ userId: row.userId, _id: { $ne: row._id } });
  await RefreshToken.deleteMany({ userId: row.userId as Types.ObjectId });

  logger.info("password reset completed", { userId: row.userId.toString() });
  return { ok: true as const };
}
