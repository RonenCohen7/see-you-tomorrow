import type { Response } from "express";
import { AppError, type AuthRequest } from "@syt/shared";
import { z } from "zod";
import * as authz from "../services/scheduleAuthz.js";
import * as batchSvc from "../services/scheduleAiBatchService.js";
import * as pref from "../services/attendancePreferenceService.js";
import * as empRemote from "../services/remoteEmployee.js";
import * as cycleSvc from "../services/departmentPreferenceCycleService.js";
import * as notify from "../services/notificationClient.js";

export async function listPendingPreferencePipeline(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  let departmentId =
    typeof req.query.departmentId === "string" ? req.query.departmentId.trim() : undefined;

  if (req.user.role === "manager") {
    const me = await empRemote.fetchEmployeeInternal(req.user.id);
    departmentId = me?.departmentId;
  }

  if (req.user.role === "employee") {
    throw new AppError(403, "אין הרשאה", "FORBIDDEN");
  }

  if (!departmentId || !/^[a-f\d]{24}$/i.test(departmentId)) {
    throw new AppError(400, "חסר departmentId תקף", "VALIDATION");
  }

  if (req.user.role === "manager") {
    await authz.assertCanBulkWriteDepartmentSchedules({
      userId: req.user.id,
      role: req.user.role,
      departmentId,
    });
  }

  const items = await batchSvc.listPendingPreferencePipeline(departmentId);
  res.json({ items });
}

const objectIdParam = z.string().regex(/^[a-f\d]{24}$/i);

export async function rejectAiBatch(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const idParse = objectIdParam.safeParse(req.params.id);
  if (!idParse.success) throw new AppError(400, "מזהה לא תקין", "VALIDATION");

  const batch = await batchSvc.getById(idParse.data);
  if (
    !batch ||
    batch.creationSource !== "preference_pipeline" ||
    batch.status !== "pending_manager"
  ) {
    throw new AppError(404, "אצווה לא נמצאה או שאינה ניתנת לדחייה", "NOT_FOUND");
  }

  if (req.user.role !== "admin" && req.user.role !== "manager") {
    throw new AppError(403, "אין הרשאה", "FORBIDDEN");
  }

  await authz.assertCanBulkWriteDepartmentSchedules({
    userId: req.user.id,
    role: req.user.role,
    departmentId: batch.departmentId,
  });

  const ok = await batchSvc.rejectBatch(idParse.data);
  if (!ok) throw new AppError(409, "לא ניתן לדחות את האצווה", "CONFLICT");

  await cycleSvc.markRejectedForBatch(idParse.data);
  const weekStartSunday = batch.dateRange.from;
  const rows = await pref.listDeptWeek(batch.departmentId, weekStartSunday);
  void notify.notifyPreferencePipelineRejected({
    departmentId: batch.departmentId,
    weekStartSunday,
    submitterEmployeeIds: rows.map((r) => r.employeeId),
  });
  res.json({ ok: true });
}
