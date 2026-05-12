import type { Response } from "express";
import { AppError } from "@syt/shared";
import * as rules from "../services/schedulingRuleService.js";
import * as pref from "../services/attendancePreferenceService.js";
import type { Request } from "express";

export async function schedulingRulesRange(req: Request, res: Response) {
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new AppError(400, "from/to חייבים YYYY-MM-DD", "VALIDATION");
  }
  const items = await rules.listActiveForRange(from, to);
  res.json({ items });
}

export async function preferencesDeptRange(req: Request, res: Response) {
  const departmentId = typeof req.query.departmentId === "string" ? req.query.departmentId : "";
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  if (!/^[a-f\d]{24}$/i.test(departmentId)) {
    throw new AppError(400, "departmentId לא תקין", "VALIDATION");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new AppError(400, "from/to חייבים YYYY-MM-DD", "VALIDATION");
  }
  const items = await pref.listDeptIntersectingRange(departmentId, from, to);
  res.json({ items });
}
