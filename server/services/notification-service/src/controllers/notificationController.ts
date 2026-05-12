import { randomUUID } from "crypto";
import type { Response } from "express";
import { AppError, type AuthRequest } from "@syt/shared";
import { z } from "zod";
import * as svc from "../services/notificationPersistence.js";
import { canSendSystemBroadcast } from "../services/broadcastThrottle.js";
import { emitSystemBroadcast } from "../socket.js";

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

const systemBroadcastBody = z.object({
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(2000),
  severity: z.enum(["info", "warning", "error"]).optional().default("info"),
});

export async function adminSystemBroadcast(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");

  const parsed = systemBroadcastBody.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "נתונים לא תקינים", "VALIDATION", parsed.error.flatten());
  }

  if (!canSendSystemBroadcast(req.user.id)) {
    throw new AppError(429, "המתן לפני שידור נוסף (מגבלת קצב)", "RATE_LIMIT");
  }

  const at = new Date().toISOString();
  const id = randomUUID();
  const payload = {
    id,
    title: parsed.data.title,
    message: parsed.data.message,
    severity: parsed.data.severity,
    at,
  };
  emitSystemBroadcast(payload);
  res.json({ ok: true as const, id, at });
}
