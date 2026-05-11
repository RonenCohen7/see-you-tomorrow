import type { Response } from "express";
import { AppError, requireAdmin, type AuthRequest } from "@syt/shared";
import { approveSchema, recommendSchema } from "../validations/ai.js";
import * as agg from "../services/contextAggregator.js";
import * as ai from "../services/openAiRecommend.js";

export async function recommendSchedule(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  if (req.user.role === "employee") {
    throw new AppError(403, "אין הרשאה להמלצות AI", "FORBIDDEN");
  }

  const parsed = recommendSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  if (req.user.role === "manager") {
    const me = await fetch(
      `${process.env.EMPLOYEE_SERVICE_URL ?? "http://localhost:4002"}/internal/employees/${req.user.id}`,
      { headers: { "x-internal-secret": process.env.INTERNAL_SERVICE_SECRET ?? "" } }
    ).then((r) => r.json() as Promise<{ departmentId?: string }>);
    if (me?.departmentId !== parsed.data.departmentId) {
      throw new AppError(403, "ניתן להמליץ רק למחלקה שלך", "FORBIDDEN");
    }
  }

  const employees = await agg.loadDepartmentEmployees(parsed.data.departmentId);
  const capacity = await agg.loadLocationCapacity(parsed.data.locationId);
  const auth = req.headers.authorization;
  const historical = await agg.loadSchedulesRange(
    auth,
    `departmentId=${parsed.data.departmentId}&from=${parsed.data.dateRange.from}&to=${parsed.data.dateRange.to}`
  );

  const result = await ai.generateRecommendationsPrompt({
    departmentId: parsed.data.departmentId,
    locationId: parsed.data.locationId,
    dateRange: parsed.data.dateRange,
    constraints: parsed.data.constraints,
    employees: employees.map((e) => ({ id: e.id, fullName: e.fullName })),
    capacity: capacity?.capacity,
    historicalSummaries: historical,
  });

  res.json(result);
}

export async function approveRecommendations(req: AuthRequest, res: Response) {
  const user = req.user;
  if (!user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");

  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  const dept = parsed.data.departmentId;
  const loc = parsed.data.locationId;
  const items = parsed.data.recommendations.map((r) => ({
    employeeId: r.employeeId,
    workDate: r.date,
    status: r.recommendedStatus as import("@syt/shared").ScheduleStatus,
    note: r.reason,
    updatedBy: user.id,
    ...(dept ? { departmentId: dept } : {}),
    ...(loc ? { locationId: loc } : {}),
  }));

  const url = `${process.env.SCHEDULE_SERVICE_URL ?? "http://localhost:4005"}/internal/schedules/apply-recommendations`;
  const resApply = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": process.env.INTERNAL_SERVICE_SECRET ?? "",
    },
    body: JSON.stringify({ items, adminUserId: user.id }),
  });

  if (!resApply.ok) {
    const t = await resApply.text();
    throw new AppError(502, "החלת ההמלצות נכשלה", "APPLY_FAILED", t);
  }

  const body = await resApply.json();
  res.json(body);
}

export const adminOnly = requireAdmin;
