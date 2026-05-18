import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "@syt/shared";
import * as svc from "../services/notificationPersistence.js";
import * as mailer from "../services/mailer.js";

import * as socket from "../socket.js";

export async function dashboardRefresh(_req: Request, res: Response) {
  socket.emitAuthenticatedDashboardRefresh();
  res.json({ ok: true });
}

const schedulePayload = z.object({
  scheduleId: z.string(),
  employeeId: z.string(),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
  workDate: z.string(),
  status: z.string(),
  statusDisplayHe: z.string().optional(),
  updatedBy: z.string().optional(),
  note: z.string().optional(),
});

export async function scheduleChange(req: Request, res: Response) {
  const parsed = schedulePayload.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const doc = await svc.handleScheduleChange(parsed.data);
  res.status(201).json(doc);
}

const scheduleRangePayload = z.object({
  scheduleId: z.string(),
  employeeId: z.string(),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
  workDateFrom: z.string(),
  workDateTo: z.string(),
  dayCount: z.number().int().positive(),
  status: z.string(),
  statusDisplayHe: z.string().optional(),
  updatedBy: z.string().optional(),
  note: z.string().optional(),
});

export async function scheduleRangeChange(req: Request, res: Response) {
  const parsed = scheduleRangePayload.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const doc = await svc.handleScheduleRangeChange(parsed.data);
  res.status(201).json(doc);
}

const meetingInvitePayload = z.object({
  bookingId: z.string(),
  roomId: z.string(),
  roomName: z.string(),
  locationName: z.string(),
  floor: z.string().optional(),
  workDate: z.string(),
  hourStart: z.number().optional(),
  hourEnd: z.number().optional(),
  title: z.string(),
  organizerId: z.string(),
  organizerName: z.string(),
  inviteeIds: z.array(z.string()),
  isUpdate: z.boolean().optional(),
});

export async function meetingInvite(req: Request, res: Response) {
  const parsed = meetingInvitePayload.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const doc = await svc.handleMeetingInvite(parsed.data);
  if (!doc) return res.sendStatus(204);
  res.status(201).json(doc);
}

const preferenceSubmittedPayload = z.object({
  employeeId: z.string().regex(/^[a-f\d]{24}$/i),
  departmentId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  weekStartSunday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function preferenceSubmitted(req: Request, res: Response) {
  const parsed = preferenceSubmittedPayload.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const doc = await svc.handlePreferenceSubmission(parsed.data);
  res.status(201).json(doc ?? { ok: true, notified: false });
}

const idsPayload = z.object({
  departmentId: z.string().regex(/^[a-f\d]{24}$/i),
  weekStartSunday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  submitterEmployeeIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)),
});

const messagePayload = idsPayload.extend({ message: z.string().max(1200) });

export async function preferencePipelineQueued(req: Request, res: Response) {
  const parsed = idsPayload.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const doc = await svc.handlePreferencePipelineQueued(parsed.data);
  res.status(201).json(doc ?? { ok: true });
}

const aiReadyPayload = idsPayload.extend({
  batchId: z.string().regex(/^[a-f\d]{24}$/i),
  summary: z
    .object({
      matchedPreference: z.number().optional(),
      differsFromPreference: z.number().optional(),
      noSubmittedPreferenceForSlot: z.number().optional(),
      recommendationRows: z.number().optional(),
    })
    .optional(),
});

export async function preferencePipelineAiReady(req: Request, res: Response) {
  const parsed = aiReadyPayload.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const doc = await svc.handlePreferencePipelineAiReady(parsed.data);
  res.status(201).json(doc ?? { ok: true });
}

export async function preferencePipelineAiFailed(req: Request, res: Response) {
  const parsed = messagePayload.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const doc = await svc.handlePreferencePipelineAiFailed(parsed.data);
  res.status(201).json(doc ?? { ok: true });
}

const validationManagersPayload = z.object({
  departmentId: z.string().regex(/^[a-f\d]{24}$/i),
  weekStartSunday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  message: z.string().max(1200),
});

export async function preferencePipelineValidationManagers(req: Request, res: Response) {
  const parsed = validationManagersPayload.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const doc = await svc.handlePreferencePipelineValidationManagers(parsed.data);
  res.status(201).json(doc ?? { ok: true });
}

export async function preferencePipelineNoLocation(req: Request, res: Response) {
  const parsed = idsPayload.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const doc = await svc.handlePreferencePipelineNoLocation(parsed.data);
  res.status(201).json(doc ?? { ok: true });
}

export async function preferencePipelineApplied(req: Request, res: Response) {
  const parsed = idsPayload.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const doc = await svc.handlePreferencePipelineApplied(parsed.data);
  res.status(201).json(doc ?? { ok: true });
}

export async function preferencePipelineRejected(req: Request, res: Response) {
  const parsed = idsPayload.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const doc = await svc.handlePreferencePipelineRejected(parsed.data);
  res.status(201).json(doc ?? { ok: true });
}

const pendingMgrPayload = z.object({
  departmentId: z.string().regex(/^[a-f\d]{24}$/i),
  weekStartSunday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  batchId: z.string().regex(/^[a-f\d]{24}$/i),
});

export async function preferencePipelineBatchPendingManagers(req: Request, res: Response) {
  const parsed = pendingMgrPayload.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const doc = await svc.handlePreferencePipelineBatchPendingManagers(parsed.data);
  res.status(201).json(doc ?? { ok: true });
}

const emailAttachmentPayload = z
  .object({
    to: z.string().email(),
    subject: z.string().min(1).max(200),
    text: z.string().max(8000).optional().default(""),
    filename: z.string().min(1).max(200),
    contentType: z.string().min(3).max(200).optional().default("application/pdf"),
    attachmentBase64: z.string().min(1).max(12_000_000).optional(),
    pdfBase64: z.string().min(1).max(12_000_000).optional(),
  })
  .refine((d) => Boolean(d.attachmentBase64 || d.pdfBase64), {
    message: "דרוש attachment או pdf",
    path: ["attachmentBase64"],
  });

export async function emailAttachment(req: Request, res: Response) {
  const parsed = emailAttachmentPayload.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const b64 = parsed.data.attachmentBase64 ?? parsed.data.pdfBase64 ?? "";
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    throw new AppError(400, "קובץ מצורף לא תקין", "VALIDATION");
  }
  if (buf.length < 2 || buf.length > 8_000_000) {
    throw new AppError(400, "גודל קובץ לא חוקי", "VALIDATION");
  }
  const contentType = parsed.data.contentType?.trim() || "application/octet-stream";
  await mailer.sendMailWithAttachment({
    to: parsed.data.to,
    subject: parsed.data.subject,
    text: parsed.data.text || "",
    attachment: {
      filename: parsed.data.filename,
      content: buf,
      contentType,
    },
  });
  res.status(204).end();
}
