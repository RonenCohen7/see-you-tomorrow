import type { Request, Response } from "express";
import { AppError } from "@syt/shared";
import { z } from "zod";
import { recommendSchema } from "../validations/ai.js";
import { executeRecommend } from "../services/executeRecommendSchedule.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

const internalBody = recommendSchema.extend({
  actingUserId: objectId.optional(),
});

export async function internalRecommendSchedule(req: Request, res: Response) {
  const parsed = internalBody.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  const { actingUserId, ...rest } = parsed.data;
  const result = await executeRecommend(rest, {
    actingUserId,
    enforceManagerDailyOfficeCoverage: false,
    allowFridaySaturdayOffice: false,
  });
  res.json(result);
}
