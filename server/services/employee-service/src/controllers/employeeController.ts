import type { Response } from "express";
import { AppError, requireAdmin, type AuthRequest } from "@syt/shared";
import {
  createEmployeeSchema,
  listQuerySchema,
  updateEmployeeSchema,
} from "../validations/employee.js";
import * as svc from "../services/employeeService.js";

export async function list(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new AppError(400, "שאילתה לא תקינה", "VALIDATION", parsed.error.flatten());

  if (req.user.role === "employee") {
    throw new AppError(403, "אין הרשאה", "FORBIDDEN");
  }

  let scope: { role: typeof req.user.role; userId: string; departmentId?: string } | undefined;
  if (req.user.role === "manager") {
    const dept = await svc.getManagerDepartmentId(req.user.id);
    scope = { role: "manager", userId: req.user.id, departmentId: dept };
  }

  if (req.user.role === "admin") {
    scope = undefined;
  }

  const result = await svc.listEmployees(parsed.data, scope);
  res.json(result);
}

export async function getOne(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const { id } = req.params;
  if (req.user.role === "admin" || req.user.id === id) {
    const e = await svc.getById(id);
    return res.json(e);
  }
  if (req.user.role === "manager") {
    const dept = await svc.getManagerDepartmentId(req.user.id);
    const target = await svc.getById(id);
    if (dept && target.departmentId === dept) return res.json(target);
  }
  throw new AppError(403, "אין הרשאה", "FORBIDDEN");
}

export async function getMe(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const e = await svc.getMe(req.user.id);
  res.json(e);
}

/** Any authenticated role — scoped by department for manager/employee. */
export async function birthdaysRange(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  const result = await svc.listBirthdaysInRange(from, to, { id: req.user.id, role: req.user.role });
  res.json(result);
}

export async function create(req: AuthRequest, res: Response) {
  const parsed = createEmployeeSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const result = await svc.createEmployee(parsed.data);
  res.status(201).json(result);
}

export async function update(req: AuthRequest, res: Response) {
  const parsed = updateEmployeeSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const result = await svc.updateEmployee(req.params.id, parsed.data);
  res.json(result);
}

export async function remove(req: AuthRequest, res: Response) {
  const result = await svc.deleteEmployee(req.params.id);
  res.json(result);
}

/** Admin-only middleware applied at router */
export const adminOnly = requireAdmin;
