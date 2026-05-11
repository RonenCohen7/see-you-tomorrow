import type { Response } from "express";
import { AppError, type AuthRequest } from "@syt/shared";
import { z } from "zod";
import * as svc from "../services/notificationPersistence.js";

const listQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(30),
});

export async function list(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) throw new AppError(400, "שאילתה לא תקינה", "VALIDATION", parsed.error.flatten());
  const data = await svc.listForUser(req.user.id, parsed.data.page, parsed.data.limit);
  res.json(data);
}

export async function unread(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const count = await svc.unreadCount(req.user.id);
  res.json({ count });
}

export async function markRead(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const doc = await svc.markRead(req.params.id, req.user.id);
  if (!doc) throw new AppError(404, "התראה לא נמצאה", "NOT_FOUND");
  res.json(doc);
}
