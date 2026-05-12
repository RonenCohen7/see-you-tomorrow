import type { Request, Response } from "express";
import { AppError } from "@syt/shared";
import * as svc from "../services/scheduleService.js";

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
