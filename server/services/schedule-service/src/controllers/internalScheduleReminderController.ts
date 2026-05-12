import type { Response } from "express";
import type { Request } from "express";
import { AppError } from "@syt/shared";
import { z } from "zod";
import * as orgSettings from "../services/orgSettingsService.js";
import * as pref from "../services/attendancePreferenceService.js";

export async function orgPreferenceSnippet(_req: Request, res: Response) {
  const org = await orgSettings.getOrgSchedulesFull();
  res.json(org);
}

export async function preferenceReminderEnvelope(_req: Request, res: Response) {
  const org = await orgSettings.getOrgSchedulesFull();
  const targetWeek = pref.earliestAllowedPreferenceWeekSunday(org.preferenceMinDaysAhead);
  res.json({
    remindersEnabled: org.preferenceRemindersEnabled,
    preferenceMinDaysAhead: org.preferenceMinDaysAhead,
    targetWeekStartSunday: targetWeek,
  });
}

const missingSchema = z.object({
  weekStartSunday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  candidateIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(10_000),
});

export async function preferenceMissingSubmitters(req: Request, res: Response) {
  const parsed = missingSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const missing = await pref.getMissingSubmissionEmployeeIds(
    parsed.data.weekStartSunday,
    parsed.data.candidateIds
  );
  res.json({ missing });
}
