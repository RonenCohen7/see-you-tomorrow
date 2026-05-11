import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "@syt/shared";
import * as svc from "../services/notificationPersistence.js";

const schedulePayload = z.object({
  scheduleId: z.string(),
  employeeId: z.string(),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
  workDate: z.string(),
  status: z.string(),
  updatedBy: z.string().optional(),
  note: z.string().optional(),
});

export async function scheduleChange(req: Request, res: Response) {
  const parsed = schedulePayload.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const doc = await svc.handleScheduleChange(parsed.data);
  res.status(201).json(doc);
}
