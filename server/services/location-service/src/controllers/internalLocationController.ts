import type { Request, Response } from "express";
import { AppError } from "@syt/shared";
import * as svc from "../services/locationService.js";
import * as parking from "../services/parkingService.js";

export async function getOne(req: Request, res: Response) {
  try {
    const item = await svc.getById(req.params.id);
    res.json(item);
  } catch {
    res.status(404).json({ error: "לא נמצא" });
  }
}

export async function syncManagerOfficeAutoParking(req: Request, res: Response) {
  const employeeId =
    typeof req.body?.employeeId === "string" ? req.body.employeeId.trim().replace(/^"+|"+$/g, "") : "";
  const workDate =
    typeof req.body?.workDate === "string" ? req.body.workDate.trim().replace(/^"+|"+$/g, "") : "";
  const status =
    typeof req.body?.status === "string" ? req.body.status.trim().replace(/^"+|"+$/g, "") : "";

  const hex24 = /^[a-f\d]{24}$/i;
  const isoDay = /^\d{4}-\d{2}-\d{2}$/;

  let locationHex: string | undefined;
  const locBody = req.body?.locationId;
  if (locBody !== undefined && locBody !== null && String(locBody).length > 0) {
    locationHex = typeof locBody === "string" ? locBody.trim().replace(/^"+|"+$/g, "") : "";
    if (!hex24.test(locationHex)) throw new AppError(400, "locationId לא תקין", "VALIDATION");
  }

  if (!hex24.test(employeeId)) throw new AppError(400, "employeeId לא תקין", "VALIDATION");
  if (!isoDay.test(workDate)) throw new AppError(400, "תאריך לא תקין", "VALIDATION");

  const result = await parking.syncAutoParkingFromScheduleAssignment({
    employeeId,
    workDateIso: workDate,
    status,
    locationId: locationHex,
  });
  res.json({ ok: true, ...result });
}
