import type { Response } from "express";
import { AppError, type AuthRequest } from "@syt/shared";
import { z } from "zod";
import * as pref from "../services/attendancePreferenceService.js";
import * as orgSettings from "../services/orgSettingsService.js";
import * as empRemote from "../services/remoteEmployee.js";
import * as notify from "../services/notificationClient.js";
import * as cycleSvc from "../services/departmentPreferenceCycleService.js";
import {
  canEnqueuePreferenceAi,
  enqueuePreferenceAiJob,
} from "../services/preferenceAiPipelineWorker.js";
import { israeliWeekDatesFromSundayUtc } from "../utils/dateRange.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const putBody = z.object({
  weekStartSunday: isoDate,
  days: z.array(
    z.object({
      workDate: isoDate,
      preference: z.enum(["office", "home", "vacation", "off"]).optional(),
    })
  ),
  submit: z.boolean(),
});

export async function getContext(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const org = await orgSettings.getOrgSchedulesFull();
  const minDays = org.preferenceMinDaysAhead;
  const earliest = pref.earliestAllowedPreferenceWeekSunday(minDays);
  res.json({
    preferenceMinDaysAhead: minDays,
    earliestAllowedWeekStartSunday: earliest,
    preferenceRemindersEnabled: org.preferenceRemindersEnabled,
  });
}

export async function getWeek(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  if (req.user.role !== "employee") {
    throw new AppError(403, "רק עובדים יכולים לטעון העדפה אישית כאן", "FORBIDDEN");
  }
  const weekStartSunday = req.params.weekStartSunday;
  const doc = await pref.getMine(req.user.id, weekStartSunday);
  if (doc) {
    res.json(doc);
    return;
  }
  const days = israeliWeekDatesFromSundayUtc(weekStartSunday).map((workDate) => ({ workDate }));
  res.json({
    id: "",
    employeeId: req.user.id,
    weekStartSunday,
    days,
    status: "draft" as const,
  });
}

export async function putWeek(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  if (req.user.role !== "employee") {
    throw new AppError(403, "רק עובדים יכולים לשמור העדפות כאן", "FORBIDDEN");
  }

  const parsed = putBody.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  const me = await empRemote.fetchEmployeeInternal(req.user.id);
  const deptId = me?.departmentId ?? undefined;

  const days = normalizeDaysToIsraeliWeek(parsed.data.weekStartSunday, parsed.data.days);
  const saved = await pref.upsertMine({
    employeeId: req.user.id,
    departmentId: deptId,
    weekStartSunday: parsed.data.weekStartSunday,
    days,
    submit: parsed.data.submit,
  });

  if (parsed.data.submit) {
    if (deptId && canEnqueuePreferenceAi(parsed.data.weekStartSunday)) {
      await cycleSvc.upsertQueuedOnSubmit(deptId, parsed.data.weekStartSunday);
      void enqueuePreferenceAiJob(deptId, parsed.data.weekStartSunday);
      void notify.notifyPreferencePipelineQueued({
        departmentId: deptId,
        weekStartSunday: parsed.data.weekStartSunday,
        submitterEmployeeIds: [req.user.id],
      });
    }
    void notify.notifyPreferenceSubmitted({
      employeeId: req.user.id,
      ...(deptId ? { departmentId: deptId } : {}),
      weekStartSunday: parsed.data.weekStartSunday,
    });
  }

  res.json(saved);
}

const pipelineQuery = z.object({
  weekStartSunday: isoDate,
});

export async function getPipelineStatus(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  if (req.user.role !== "employee") {
    throw new AppError(403, "רק למשתמשי עובד", "FORBIDDEN");
  }
  const parsed = pipelineQuery.safeParse(req.query);
  if (!parsed.success) throw new AppError(400, "שאילתה לא תקינה", "VALIDATION", parsed.error.flatten());
  const data = await cycleSvc.getPublicForEmployee(req.user.id, parsed.data.weekStartSunday);
  res.json(data);
}

const deptPipelineQuery = z.object({
  departmentId: z.string().regex(/^[a-f\d]{24}$/i),
  weekStartSunday: isoDate,
});

/** מצב צינור למחלקה — מנהל (מחלקה שלו בלבד) או אדמין. */
export async function getDeptPipelineStatus(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = deptPipelineQuery.safeParse(req.query);
  if (!parsed.success) throw new AppError(400, "שאילתה לא תקינה", "VALIDATION", parsed.error.flatten());

  if (req.user.role === "admin") {
    const data = await cycleSvc.getPublicForDepartment(parsed.data.departmentId, parsed.data.weekStartSunday);
    res.json(data);
    return;
  }

  if (req.user.role === "manager") {
    const me = await empRemote.fetchEmployeeInternal(req.user.id);
    if (me?.departmentId !== parsed.data.departmentId) {
      throw new AppError(403, "ניתן לצפות רק במחלקתך", "FORBIDDEN");
    }
    const data = await cycleSvc.getPublicForDepartment(parsed.data.departmentId, parsed.data.weekStartSunday);
    res.json(data);
    return;
  }

  throw new AppError(403, "אין הרשאה", "FORBIDDEN");
}

function normalizeDaysToIsraeliWeek(
  weekStartSunday: string,
  days: Array<{ workDate: string; preference?: "office" | "home" | "vacation" | "off" }>
) {
  const allowed = new Set(israeliWeekDatesFromSundayUtc(weekStartSunday));
  const byDate = new Map(days.map((d) => [d.workDate, d.preference]));
  return [...allowed].map((workDate) => ({
    workDate,
    preference: byDate.get(workDate),
  }));
}

const deptWeekQuery = z.object({
  departmentId: z.string().regex(/^[a-f\d]{24}$/i),
  weekStartSunday: isoDate,
});

export async function listDeptSubmitted(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");

  const parsed = deptWeekQuery.safeParse(req.query);
  if (!parsed.success) throw new AppError(400, "שאילתה לא תקינה", "VALIDATION", parsed.error.flatten());

  if (req.user.role === "admin") {
    const items = await pref.listDeptWeek(parsed.data.departmentId, parsed.data.weekStartSunday);
    return res.json({ items });
  }

  if (req.user.role === "manager") {
    const me = await empRemote.fetchEmployeeInternal(req.user.id);
    if (me?.departmentId !== parsed.data.departmentId) {
      throw new AppError(403, "ניתן לצפות רק במחלקתך", "FORBIDDEN");
    }
    const items = await pref.listDeptWeek(parsed.data.departmentId, parsed.data.weekStartSunday);
    return res.json({ items });
  }

  throw new AppError(403, "אין הרשאה", "FORBIDDEN");
}
