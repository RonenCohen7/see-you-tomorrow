import type { Response } from "express";
import { AppError, requireAdmin, type AuthRequest } from "@syt/shared";
import {
  createLocationSchema,
  listQuerySchema,
  updateLocationSchema,
} from "../validations/location.js";
import * as svc from "../services/locationService.js";

export async function list(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new AppError(400, "שאילתה לא תקינה", "VALIDATION", parsed.error.flatten());

  const items = await svc.listLocations(parsed.data);
  res.json({ items });
}

export async function getOne(req: AuthRequest, res: Response) {
  const item = await svc.getById(req.params.id);
  res.json(item);
}

export async function create(req: AuthRequest, res: Response) {
  const parsed = createLocationSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const result = await svc.createLocation(parsed.data);
  res.status(201).json(result);
}

export async function update(req: AuthRequest, res: Response) {
  const parsed = updateLocationSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const result = await svc.updateLocation(req.params.id, parsed.data);
  res.json(result);
}

export async function remove(req: AuthRequest, res: Response) {
  const result = await svc.deleteLocation(req.params.id);
  res.json(result);
}

export const adminOnly = requireAdmin;
