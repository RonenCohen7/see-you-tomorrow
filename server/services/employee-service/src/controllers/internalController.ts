import type { Response } from "express";
import type { Request } from "express";
import type { Role } from "@syt/shared";
import * as svc from "../services/employeeService.js";

export async function getOne(req: Request, res: Response) {
  const doc = await svc.internalGetById(req.params.id);
  if (!doc) return res.status(404).json({ error: "לא נמצא" });
  res.json(doc);
}

export async function byDepartment(req: Request, res: Response) {
  const items = await svc.internalListByDepartment(req.params.departmentId);
  res.json({ items });
}

export async function adminIds(_req: Request, res: Response) {
  const ids = await svc.internalAdminIds();
  res.json({ ids });
}

export async function listIdsByRole(req: Request, res: Response) {
  const role = req.params.role as Role;
  if (!["employee", "manager", "admin"].includes(role)) {
    return res.status(400).json({ error: "תפקיד לא תקין" });
  }
  const ids = await svc.internalIdsByRole(role);
  res.json({ ids });
}
