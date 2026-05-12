import type { Response } from "express";
import { AppError, requireAdmin, SCHEDULING_RULE_TYPES, type AuthRequest } from "@syt/shared";
import { z } from "zod";
import * as rules from "../services/schedulingRuleService.js";

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
