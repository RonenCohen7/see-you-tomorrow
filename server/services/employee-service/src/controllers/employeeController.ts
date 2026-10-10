import type { Response } from "express";
import { AppError, requireAdmin, requireRoles, type AuthRequest } from "@syt/shared";
import {
  bulkImportEmployeesSchema,
  createEmployeeSchema,
  listQuerySchema,
  selfAssignDepartmentSchema,
  updateEmployeeSchema,
} from "../validations/employee.js";
import * as svc from "../services/employeeService.js";

export async function list(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new AppError(400, "שאילתה לא תקינה", "VALIDATION", parsed.error.flatten());

  const { scope: view, ...query } = parsed.data;
  if (view === "company") {
    const result = await svc.listEmployees(query);
    if (req.user.role === "admin" || req.user.role === "manager") return res.json(result);
    return res.json({ ...result, items: result.items.map(svc.toDirectoryEntry) });
  }

  let scope: { role: typeof req.user.role; userId: string; departmentId?: string } | undefined;
  if (req.user.role === "employee") {
    const dept = await svc.getManagerDepartmentId(req.user.id);
    scope = { role: "employee", userId: req.user.id, departmentId: dept };
  } else if (req.user.role === "manager") {
    const dept = await svc.getManagerDepartmentId(req.user.id);
    scope = { role: "manager", userId: req.user.id, departmentId: dept };
  } else if (req.user.role === "admin") {
    scope = undefined;
  }

  const result = await svc.listEmployees(query, scope);
  res.json(result);
}

export async function getOne(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const { id } = req.params;
  if (req.user.role === "admin" || req.user.role === "manager" || req.user.id === id) {
    const e = await svc.getById(id);
    return res.json(e);
  }
  throw new AppError(403, "אין הרשאה", "FORBIDDEN");
}

export async function getMe(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const e = await svc.getMe(req.user.id);
  res.json(e);
}

export async function selfAssignDepartment(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = selfAssignDepartmentSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const e = await svc.selfAssignDepartment(req.user.id, parsed.data.departmentId);
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

export async function importBulk(req: AuthRequest, res: Response) {
  const parsed = bulkImportEmployeesSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const result = await svc.importEmployeesBulk(parsed.data);
  res.json(result);
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
/** Create and edit employees. Delete stays admin-only. */
export const managerOrAdmin = requireRoles("admin", "manager");
