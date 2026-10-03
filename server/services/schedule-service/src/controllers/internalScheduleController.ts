import type { Request, Response } from "express";
import { AppError } from "@syt/shared";
import { applyRecommendationsSchema, officePresenceBatchSchema } from "../validations/schedule.js";
import * as svc from "../services/scheduleService.js";
import * as applySvc from "../services/applyRecommendationsService.js";

export async function applyRecommendations(req: Request, res: Response) {
  const parsed = applyRecommendationsSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  res.json(await applySvc.applyRecommendations(parsed.data));
}

export async function officePresenceBatch(req: Request, res: Response) {
  const parsed = officePresenceBatchSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const results = await svc.officePresenceBatch(parsed.data.checks);
  res.json({ results });
}
