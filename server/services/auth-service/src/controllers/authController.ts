import type { Response } from "express";
import {
  AppError,
  getRequestTenantSlug,
  isSharedSaasMode,
  logger,
  markInviteUsed,
  resolveTenantsForAuth,
} from "@syt/shared";
import type { AuthRequest } from "@syt/shared";
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerOrganizationSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validations/auth.js";
import * as authService from "../services/authService.js";
import * as passwordResetService from "../services/passwordResetService.js";
import { shouldAllowRegistration } from "../services/bootstrap.js";
import { assertTurnstileOk } from "../services/turnstile.js";

/**
 * Shared SaaS: joining an existing company with its company code or a valid invite link is the
 * normal signup path, so it stays open in production. The tenant is re-resolved here from the
 * platform registry and must match the tenant this request is scoped to.
 */
async function joinsCompanyByCodeOrInvite(req: AuthRequest, email: string): Promise<boolean> {
  if (!isSharedSaasMode()) return false;
  const scopedSlug = getRequestTenantSlug();
  if (!scopedSlug) return false;
  const body = (req.body ?? {}) as { tenantSlug?: unknown; inviteToken?: unknown };
  const tenantSlug = typeof body.tenantSlug === "string" ? body.tenantSlug.trim() : "";
  const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken.trim() : "";
  if (!tenantSlug && !inviteToken) return false;
  try {
    const tenants = await resolveTenantsForAuth({
      email,
      tenantSlug: tenantSlug || undefined,
      inviteToken: inviteToken || undefined,
    });
    return tenants.some((t) => t.slug === scopedSlug);
  } catch (e) {
    logger.error("POST /api/auth/register company lookup failed", e instanceof Error ? e : undefined);
    return false;
  }
}

export async function register(req: AuthRequest, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn("POST /api/auth/register validation failed", parsed.error.flatten());
    throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  }

  await assertTurnstileOk(parsed.data.turnstileToken, req);

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

  const joinsVerifiedCompany = await joinsCompanyByCodeOrInvite(req, email);
  const allow =
    explicitAllow || (!explicitDeny && !isProduction) || dbAllowsFirstUserOnly || joinsVerifiedCompany;

  logger.info("POST /api/auth/register attempt", {
    email,
    NODE_ENV: process.env.NODE_ENV ?? "(unset)",
    explicitAllow,
    explicitDeny,
    isProduction,
    dbEmptyAllowsBootstrap: dbAllowsFirstUserOnly,
    joinsVerifiedCompany,
    allow,
  });

  if (!allow) {
    logger.warn("POST /api/auth/register rejected (REGISTER_CLOSED)", { email });
    throw new AppError(403, "הרשמה סגורה. פנה למנהל המערכת.", "REGISTER_CLOSED");
  }

  try {
    const { turnstileToken: _tok, ...reg } = parsed.data;
    void _tok;
    const result = await authService.registerEmployee(reg);
    logger.info("POST /api/auth/register success", { email, role: result.employee.role });
    const inviteToken = typeof req.body?.inviteToken === "string" ? req.body.inviteToken.trim() : "";
    if (joinsVerifiedCompany && inviteToken) {
      await markInviteUsed(inviteToken).catch((e) =>
        logger.error("POST /api/auth/register markInviteUsed failed", e instanceof Error ? e : undefined)
      );
    }
    res.status(201).json(result);
  } catch (e) {
    logger.error("POST /api/auth/register registerEmployee failed", e instanceof Error ? e : undefined);
    throw e;
  }
}

export async function registerDepartments(_req: AuthRequest, res: Response) {
  const items = await authService.listRegistrationDepartments();
  res.json({ items });
}

export async function registerOrganization(req: AuthRequest, res: Response) {
  const parsed = registerOrganizationSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  }
  await assertTurnstileOk(parsed.data.turnstileToken, req);
  const { turnstileToken: _tok, ...input } = parsed.data;
  void _tok;
  const result = await authService.registerOrganization(input);
  logger.info("POST /api/auth/register-organization success", {
    slug: result.tenant.slug,
    email: result.employee.email,
  });
  res.status(201).json(result);
}

export async function login(req: AuthRequest, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  await assertTurnstileOk(parsed.data.turnstileToken, req);

  const { turnstileToken: _tok, ...creds } = parsed.data;
  void _tok;
  const result = await authService.login(creds);
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

  await assertTurnstileOk(parsed.data.turnstileToken, req);

  await passwordResetService.requestPasswordReset(parsed.data.email, parsed.data.locale ?? "he");
  res.json({ ok: true });
}

export async function resetPassword(req: AuthRequest, res: Response) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  await passwordResetService.resetPasswordWithToken(parsed.data.token, parsed.data.password);
  res.json({ ok: true });
}
