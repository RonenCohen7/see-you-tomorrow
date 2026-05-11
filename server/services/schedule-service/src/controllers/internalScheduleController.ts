import type { Request, Response } from "express";
import { AppError } from "@syt/shared";
import { applyRecommendationsSchema, officePresenceBatchSchema } from "../validations/schedule.js";
import * as svc from "../services/scheduleService.js";

export async function applyRecommendations(req: Request, res: Response) {
  const parsed = applyRecommendationsSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const adminUserId = typeof req.body.adminUserId === "string" ? req.body.adminUserId : undefined;
  const items = parsed.data.items.map((i) => ({
    ...i,
    updatedBy: adminUserId,
  }));
  const results = await svc.upsertBulkInternal(items);
  res.json({ applied: results.length, results });
}

export async function officePresenceBatch(req: Request, res: Response) {
  const parsed = officePresenceBatchSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const results = await svc.officePresenceBatch(parsed.data.checks);
  res.json({ results });
}
