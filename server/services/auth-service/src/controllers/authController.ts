import type { Response } from "express";
import { AppError, logger } from "@syt/shared";
import type { AuthRequest } from "@syt/shared";
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validations/auth.js";
import * as authService from "../services/authService.js";
import * as passwordResetService from "../services/passwordResetService.js";
import { shouldAllowRegistration } from "../services/bootstrap.js";

export async function register(req: AuthRequest, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn("POST /api/auth/register validation failed", parsed.error.flatten());
    throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  }

  const email = parsed.data.email;

  // Prod: only first user (empty DB) or ALLOW_PUBLIC_REGISTER=true.
  // Non-production: open by default so local dev works after seed; set ALLOW_PUBLIC_REGISTER=false to lock.
  const explicitAllow = process.env.ALLOW_PUBLIC_REGISTER === "true";
  const explicitDeny = process.env.ALLOW_PUBLIC_REGISTER === "false";
  const isProduction = process.env.NODE_ENV === "production";
  let dbAllowsFirstUserOnly = false;
  try {
    dbAllowsFirstUserOnly = await shouldAllowRegistration();
  } catch (e) {
    logger.error("POST /api/auth/register shouldAllowRegistration (Mongo?) failed", e instanceof Error ? e : undefined);
    throw e;
  }

  const allow = explicitAllow || (!explicitDeny && !isProduction) || dbAllowsFirstUserOnly;

  logger.info("POST /api/auth/register attempt", {
    email,
    NODE_ENV: process.env.NODE_ENV ?? "(unset)",
    explicitAllow,
    explicitDeny,
    isProduction,
    dbEmptyAllowsBootstrap: dbAllowsFirstUserOnly,
    allow,
  });

  if (!allow) {
    logger.warn("POST /api/auth/register rejected (REGISTER_CLOSED)", { email });
    throw new AppError(403, "הרשמה סגורה. פנה למנהל המערכת.", "REGISTER_CLOSED");
  }

  try {
    const result = await authService.registerEmployee(parsed.data);
    logger.info("POST /api/auth/register success", { email, role: result.employee.role });
    res.status(201).json(result);
  } catch (e) {
    logger.error("POST /api/auth/register registerEmployee failed", e instanceof Error ? e : undefined);
    throw e;
  }
}

export async function login(req: AuthRequest, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  const result = await authService.login(parsed.data);
  res.json(result);
}

export async function logout(req: AuthRequest, res: Response) {
  const parsed = logoutSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  await authService.logout(parsed.data.refreshToken);
  res.json({ ok: true });
}

export async function refresh(req: AuthRequest, res: Response) {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  const result = await authService.refresh(parsed.data.refreshToken);
  res.json(result);
}

export async function me(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const profile = await authService.getProfile(req.user.id);
  res.json(profile);
}

export async function forgotPassword(req: AuthRequest, res: Response) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  await passwordResetService.requestPasswordReset(parsed.data.email, parsed.data.locale ?? "he");
  res.json({ ok: true });
}

export async function resetPassword(req: AuthRequest, res: Response) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  await passwordResetService.resetPasswordWithToken(parsed.data.token, parsed.data.password);
  res.json({ ok: true });
}
