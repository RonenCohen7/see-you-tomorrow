import type { Response } from "express";
import { AppError, requireAdmin, requireAuth, type AuthRequest } from "@syt/shared";
import { z } from "zod";
import * as svc from "../services/parkingService.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

const seedTenSchema = z.object({
  locationId: objectId,
});

const patchSpotSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  assignedEmployeeId: objectId.nullable().optional(),
  isActive: z.boolean().optional(),
});

const createReservationSchema = z.object({
  spotId: objectId,
  employeeId: objectId,
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hourStart: z.number().min(0).max(24).optional(),
  hourEnd: z.number().min(0).max(24).optional(),
  note: z.string().max(500).optional(),
});

export async function listSpots(_req: AuthRequest, res: Response) {
  const items = await svc.listSpots();
  res.json({ items });
}

export async function seedTen(req: AuthRequest, res: Response) {
  const parsed = seedTenSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const result = await svc.seedTenSpots(parsed.data.locationId);
  res.status(201).json(result);
}

export async function patchSpot(req: AuthRequest, res: Response) {
  const parsed = patchSpotSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const item = await svc.updateSpot(req.params.id, parsed.data);
  res.json(item);
}

export async function listReservations(req: AuthRequest, res: Response) {
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  if (!from || !to) throw new AppError(400, "נדרשים from ו-to", "VALIDATION");
  const items = await svc.listReservations(from, to);
  res.json({ items });
}

export async function createReservation(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = createReservationSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const item = await svc.createReservation({
    ...parsed.data,
    createdBy: req.user.id,
    actorRole: req.user.role as "admin" | "manager" | "employee",
    actorUserId: req.user.id,
  });
  res.status(201).json(item);
}

export async function deleteReservation(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const result = await svc.deleteReservation(req.params.id, {
    role: req.user.role as "admin" | "manager" | "employee",
    userId: req.user.id,
  });
  res.json(result);
}

export { requireAuth, requireAdmin };
