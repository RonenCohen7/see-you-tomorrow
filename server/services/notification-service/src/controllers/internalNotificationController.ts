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
