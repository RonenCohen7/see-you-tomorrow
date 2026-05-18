import type { Response } from "express";
import { AppError, requireAdmin, SCHEDULING_RULE_TYPES, type AuthRequest } from "@syt/shared";
import { z } from "zod";
import * as rules from "../services/schedulingRuleService.js";
import * as conflictSvc from "../services/schedulingRuleConflictsService.js";

export const schedulingRuleAdmin = requireAdmin;

const createBody = z.object({
  ruleType: z.enum(SCHEDULING_RULE_TYPES),
  payload: z.record(z.unknown()),
  isActive: z.boolean().optional(),
  priority: z.number().optional(),
});

const patchBody = z.object({
  payload: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().optional(),
});

const checkConflictsBody = z.object({
  ruleType: z.enum(SCHEDULING_RULE_TYPES),
  payload: z.record(z.unknown()),
  isActive: z.boolean().optional(),
  locations: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  locale: z.enum(["he", "en"]).optional(),
});

const summariesQuery = z.object({
  locale: z.enum(["he", "en"]).optional(),
});

export async function list(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const items = await rules.listRules();
  res.json({ items });
}

export async function create(req: AuthRequest, res: Response) {
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const item = await rules.createRule(parsed.data as Parameters<typeof rules.createRule>[0]);
  res.status(201).json(item);
}

export async function update(req: AuthRequest, res: Response) {
  const parsed = patchBody.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const item = await rules.updateRule(req.params.id, parsed.data);
  res.json(item);
}

export async function remove(req: AuthRequest, res: Response) {
  await rules.deleteRule(req.params.id);
  res.status(204).end();
}

export async function checkConflicts(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = checkConflictsBody.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const result = await conflictSvc.checkConflicts({
    ruleType: parsed.data.ruleType,
    payload: parsed.data.payload,
    isActive: parsed.data.isActive,
    locationNames: parsed.data.locations,
    locale: parsed.data.locale,
  });
  res.json(result);
}

export async function listSummaries(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = summariesQuery.safeParse(req.query);
  if (!parsed.success) throw new AppError(400, "שאילתה לא תקינה", "VALIDATION", parsed.error.flatten());
  const locale = parsed.data.locale ?? "he";
  const locations =
    typeof req.query.locations === "string"
      ? (JSON.parse(req.query.locations) as { id: string; name: string }[])
      : [];
  const items = await conflictSvc.listRulesWithSummaries(locations, locale);
  res.json({ items });
}
