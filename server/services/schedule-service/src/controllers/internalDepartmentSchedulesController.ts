import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "@syt/shared";
import * as svc from "../services/scheduleService.js";
import * as pref from "../services/attendancePreferenceService.js";
import * as cycleSvc from "../services/departmentPreferenceCycleService.js";
import { canEnqueuePreferenceAi, enqueuePreferenceAiJob } from "../services/preferenceAiPipelineWorker.js";

export async function listDepartmentRangeForAi(req: Request, res: Response) {
  const departmentId = typeof req.query.departmentId === "string" ? req.query.departmentId : "";
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  if (!/^[a-f\d]{24}$/i.test(departmentId)) {
    throw new AppError(400, "departmentId לא תקין", "VALIDATION");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new AppError(400, "from/to חייבים YYYY-MM-DD", "VALIDATION");
  }
  const items = await svc.listSchedules({ departmentId, from, to });
  res.json({ items });
}

const clearFutureBody = z.object({
  employeeId: z.string().regex(/^[a-f\d]{24}$/i),
  fromInclusive: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const assignDepartmentBody = z.object({
  employeeId: z.string().regex(/^[a-f\d]{24}$/i),
  departmentId: z.string().regex(/^[a-f\d]{24}$/i),
});

/** Internal only: employee just got a department — attach it to upcoming preferences and run AI for submitted weeks. */
export async function assignDepartmentToPreferences(req: Request, res: Response) {
  const parsed = assignDepartmentBody.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const { employeeId, departmentId } = parsed.data;
  const weeks = await pref.assignDepartmentToUpcoming(employeeId, departmentId);
  const enqueued: string[] = [];
  for (const week of weeks) {
    if (!canEnqueuePreferenceAi(week)) continue;
    await cycleSvc.upsertQueuedOnSubmit(departmentId, week);
    void enqueuePreferenceAiJob(departmentId, week);
    enqueued.push(week);
  }
  res.json({ ok: true, updatedSubmittedWeeks: weeks, enqueued });
}

/** Internal only: drop all shifts for employee on/after optional `fromInclusive` (default UTC today). */
export async function clearFutureForEmployee(req: Request, res: Response) {
  const parsed = clearFutureBody.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const deletedCount = await svc.deleteFutureSchedulesForEmployee({
    employeeId: parsed.data.employeeId,
    fromInclusive: parsed.data.fromInclusive,
  });
  res.status(200).json({ ok: true, deletedCount });
}
