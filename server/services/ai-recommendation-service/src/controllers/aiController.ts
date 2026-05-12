import type { Response } from "express";
import { AppError, type AuthRequest } from "@syt/shared";
import { approveSchema, recommendSchema } from "../validations/ai.js";
import { executeRecommend } from "../services/executeRecommendSchedule.js";

async function fetchMyDepartment(userId: string): Promise<string | undefined> {
  const res = await fetch(
    `${process.env.EMPLOYEE_SERVICE_URL ?? "http://localhost:4002"}/internal/employees/${userId}`,
    { headers: { "x-internal-secret": process.env.INTERNAL_SERVICE_SECRET ?? "" } }
  );
  if (!res.ok) return undefined;
  const body = (await res.json()) as { departmentId?: string };
  return body.departmentId;
}

function assertCanApproveAiRecommendations(opts: {
  role: string;
  userDepartmentId?: string;
  approvalDepartmentId: string;
}) {
  if (opts.role === "admin") return;
  if (opts.role !== "manager") throw new AppError(403, "אין הרשאה לאישור שיבוץ AI", "FORBIDDEN");
  if (!opts.userDepartmentId || opts.userDepartmentId !== opts.approvalDepartmentId) {
    throw new AppError(403, "ניתן לאשר רק למחלקתך", "FORBIDDEN");
  }
}

export async function recommendSchedule(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  if (req.user.role === "employee") {
    throw new AppError(403, "אין הרשאה להמלצות AI", "FORBIDDEN");
  }

  const parsed = recommendSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  const wantsFridaySaturdayOffice = parsed.data.allowFridaySaturdayOffice === true;
  if (wantsFridaySaturdayOffice && req.user.role !== "admin") {
    throw new AppError(
      403,
      "אישור שיבוץ משרד בשישי/שבת מוגבל למנהלי מערכת (אדמין)",
      "FORBIDDEN"
    );
  }

  if (req.user.role === "manager") {
    const dept = await fetchMyDepartment(req.user.id);
    if (!dept || dept !== parsed.data.departmentId) {
      throw new AppError(403, "ניתן להמליץ רק למחלקה שלך", "FORBIDDEN");
    }
  }

  const auth = req.headers.authorization;
  const result = await executeRecommend(parsed.data, { authorizationHeader: auth });
  res.json(result);
}

export async function approveRecommendations(req: AuthRequest, res: Response) {
  const user = req.user;
  if (!user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");

  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  const dept = parsed.data.departmentId;
  const userDept = await fetchMyDepartment(user.id);
  assertCanApproveAiRecommendations({
    role: user.role,
    userDepartmentId: userDept,
    approvalDepartmentId: dept,
  });

  const loc = parsed.data.locationId;
  const recs = parsed.data.recommendations;
  const dates = recs.map((r) => r.date).sort();
  const dateRange = {
    from: dates[0] ?? recs[0]!.date,
    to: dates[dates.length - 1] ?? recs[0]!.date,
  };

  const items = recs.map((r) => ({
    employeeId: r.employeeId,
    workDate: r.date,
    status: r.recommendedStatus as import("@syt/shared").ScheduleStatus,
    note:
      (r.reason ? `${r.reason}\n` : "") + "שובץ על ידי המלצת AI (אושר בממשק הניהול).",
    updatedBy: user.id,
    ...(dept ? { departmentId: dept } : {}),
    ...(loc ? { locationId: loc } : {}),
  }));

  const aiMeta =
    parsed.data.aiBatchId === undefined
      ? {
          departmentId: dept,
          locationId: loc,
          dateRange,
          confidence: parsed.data.confidence,
          model: parsed.data.model,
          validationNotes: parsed.data.validationNotes,
        }
      : undefined;

  const url = `${process.env.SCHEDULE_SERVICE_URL ?? "http://localhost:4005"}/internal/schedules/apply-recommendations`;
  const resApply = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": process.env.INTERNAL_SERVICE_SECRET ?? "",
    },
    body: JSON.stringify({
      items,
      adminUserId: user.id,
      scheduleSource: "ai",
      ...(parsed.data.aiBatchId ? { aiBatchId: parsed.data.aiBatchId } : {}),
      ...(aiMeta ? { aiMeta } : {}),
    }),
  });

  if (!resApply.ok) {
    const t = await resApply.text();
    throw new AppError(502, "החלת ההמלצות נכשלה", "APPLY_FAILED", t);
  }

  const body = await resApply.json();
  res.json(body);
}
