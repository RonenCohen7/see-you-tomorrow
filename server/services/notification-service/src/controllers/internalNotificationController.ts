import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "@syt/shared";
import * as svc from "../services/notificationPersistence.js";
import * as mailer from "../services/mailer.js";

const schedulePayload = z.object({
  scheduleId: z.string(),
  employeeId: z.string(),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
  workDate: z.string(),
  status: z.string(),
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
  updatedBy: z.string().optional(),
  note: z.string().optional(),
});

export async function scheduleRangeChange(req: Request, res: Response) {
  const parsed = scheduleRangePayload.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const doc = await svc.handleScheduleRangeChange(parsed.data);
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

const emailAttachmentPayload = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  text: z.string().max(8000).optional().default(""),
  filename: z.string().min(1).max(200),
  pdfBase64: z.string().min(1).max(12_000_000),
});

export async function emailAttachment(req: Request, res: Response) {
  const parsed = emailAttachmentPayload.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  let buf: Buffer;
  try {
    buf = Buffer.from(parsed.data.pdfBase64, "base64");
  } catch {
    throw new AppError(400, "קובץ PDF לא תקין", "VALIDATION");
  }
  if (buf.length < 10 || buf.length > 8_000_000) {
    throw new AppError(400, "גודל קובץ לא חוקי", "VALIDATION");
  }
  await mailer.sendMailWithAttachment({
    to: parsed.data.to,
    subject: parsed.data.subject,
    text: parsed.data.text || "",
    attachment: { filename: parsed.data.filename, content: buf, contentType: "application/pdf" },
  });
  res.status(204).end();
}
