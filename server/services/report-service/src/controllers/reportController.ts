import type { Response } from "express";
import { AppError, type AuthRequest } from "@syt/shared";
import { z } from "zod";
import { requireManagerOrAdmin } from "../middleware/requireManagerOrAdmin.js";
import { buildDailyStatusRows, buildParkingRows, REPORT_STATUSES, type ReportStatus } from "../services/reportData.js";
import { renderDailyStatusPdf, renderParkingPdf } from "../services/pdfRender.js";
import { sendPdfByEmail } from "../services/sendReportEmail.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const statusParam = z.enum(REPORT_STATUSES);
const MAX_DAILY_REPORT_DAYS = 2000;

function parseOptionalEmployeeId(req: AuthRequest): string | undefined {
  const raw = typeof req.query.employeeId === "string" ? req.query.employeeId.trim() : "";
  if (!raw || !/^[a-f\d]{24}$/i.test(raw)) return undefined;
  return raw;
}

function assertReportStatus(s: string): ReportStatus {
  const p = statusParam.safeParse(s);
  if (!p.success) throw new AppError(400, "סטטוס לא נתמך", "VALIDATION");
  return p.data;
}

/** `from`+`to` inclusive, or legacy single `date` (= one day). */
function parseDailyRangeQuery(req: AuthRequest): { from: string; to: string } {
  const q = req.query as Record<string, string | undefined>;
  const fromQ = q.from ?? "";
  const toQ = q.to ?? "";
  const dateLegacy = q.date ?? "";

  if (fromQ && toQ) {
    const f = isoDate.safeParse(fromQ);
    const t = isoDate.safeParse(toQ);
    if (!f.success || !t.success) throw new AppError(400, "תאריכים לא תקינים", "VALIDATION");
    if (f.data > t.data) throw new AppError(400, "תאריך ההתחלה אחרי תאריך הסיום", "VALIDATION");
    const span =
      Math.floor(
        (Date.parse(`${t.data}T00:00:00Z`) - Date.parse(`${f.data}T00:00:00Z`)) / 86_400_000
      ) + 1;
    if (span > MAX_DAILY_REPORT_DAYS) {
      throw new AppError(400, `טווח של יותר מ־${MAX_DAILY_REPORT_DAYS} ימים אינו נתמך`, "VALIDATION");
    }
    return { from: f.data, to: t.data };
  }

  const d = isoDate.safeParse(dateLegacy);
  if (!d.success) throw new AppError(400, "נדרשים from ו-to (או תאריך יום בודד בשדה date)", "VALIDATION");
  return { from: d.data, to: d.data };
}

function dailySubtitle(from: string, to: string): string {
  return from === to ? `תאריך: ${from}` : `טווח: ${from} — ${to} (כולל)`;
}

function dailyPdfFilename(title: string, from: string, to: string): string {
  return from === to ? `${title}-${from}.pdf` : `${title}-${from}-${to}.pdf`;
}

export async function dailyStatusPreview(req: AuthRequest, res: Response) {
  const statusRaw = typeof req.query.status === "string" ? req.query.status : "";
  const status = assertReportStatus(statusRaw);
  const { from, to } = parseDailyRangeQuery(req);
  const employeeId = parseOptionalEmployeeId(req);
  const { rows, title, filterEmployeeId, filterEmployeeName } = await buildDailyStatusRows(req, from, to, status, employeeId);
  res.json({ from, to, status, title, rows, filterEmployeeId, filterEmployeeName });
}

export async function dailyStatusPdf(req: AuthRequest, res: Response) {
  const statusRaw = typeof req.query.status === "string" ? req.query.status : "";
  const status = assertReportStatus(statusRaw);
  const { from, to } = parseDailyRangeQuery(req);
  const employeeId = parseOptionalEmployeeId(req);
  const { rows, title, filterEmployeeName } = await buildDailyStatusRows(req, from, to, status, employeeId);
  const subtitle =
    dailySubtitle(from, to) + (filterEmployeeName ? ` · עובד: ${filterEmployeeName}` : "");
  const pdf = await renderDailyStatusPdf(title, subtitle, rows);
  const fn = dailyPdfFilename(title, from, to);
  const safeAscii = `daily-${status}-${from}-${to}.pdf`.replace(/[^\w.-]+/g, "_");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(fn)}`);
  res.send(pdf);
}

const dailyEmailBody = z.object({
  from: isoDate,
  to: isoDate,
  status: statusParam,
  recipientEmail: z.string().email().optional(),
  employeeId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

export async function dailyStatusEmail(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = dailyEmailBody.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  if (parsed.data.from > parsed.data.to) {
    throw new AppError(400, "תאריך ההתחלה אחרי תאריך הסיום", "VALIDATION");
  }
  const span =
    Math.floor(
      (Date.parse(`${parsed.data.to}T00:00:00Z`) - Date.parse(`${parsed.data.from}T00:00:00Z`)) / 86_400_000
    ) + 1;
  if (span > MAX_DAILY_REPORT_DAYS) {
    throw new AppError(400, `טווח של יותר מ־${MAX_DAILY_REPORT_DAYS} ימים אינו נתמך`, "VALIDATION");
  }
  const toAddr = parsed.data.recipientEmail?.trim().toLowerCase() ?? req.user.email.toLowerCase();
  if (toAddr !== req.user.email.toLowerCase()) {
    throw new AppError(400, "ניתן לשלוח דוח רק לאימייל של המשתמש המחובר", "VALIDATION");
  }
  const { rows, title, filterEmployeeName } = await buildDailyStatusRows(
    req,
    parsed.data.from,
    parsed.data.to,
    parsed.data.status,
    parsed.data.employeeId
  );
  const subtitle =
    dailySubtitle(parsed.data.from, parsed.data.to) + (filterEmployeeName ? ` · עובד: ${filterEmployeeName}` : "");
  const pdf = await renderDailyStatusPdf(title, subtitle, rows);
  const filename = dailyPdfFilename(title, parsed.data.from, parsed.data.to);
  const rangeText =
    parsed.data.from === parsed.data.to
      ? `ליום ${parsed.data.from}`
      : `לטווח ${parsed.data.from} עד ${parsed.data.to} (כולל)`;
  await sendPdfByEmail({
    to: toAddr,
    subject: `דוח ${title} — ${parsed.data.from === parsed.data.to ? parsed.data.from : `${parsed.data.from}–${parsed.data.to}`}`,
    text: `מצורף דוח ${title} ${rangeText}.\n\nSee You Tomorrow`,
    filename,
    pdf,
  });
  res.json({ ok: true });
}

export async function parkingPreview(req: AuthRequest, res: Response) {
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  const f = isoDate.safeParse(from);
  const t = isoDate.safeParse(to);
  if (!f.success || !t.success) throw new AppError(400, "תאריכים לא תקינים", "VALIDATION");
  if (f.data > t.data) throw new AppError(400, "תאריך התחלה אחרי תאריך הסיום", "VALIDATION");
  const rows = await buildParkingRows(req, f.data, t.data);
  res.json({ from: f.data, to: t.data, title: "הקצאות חניה", rows });
}

export async function parkingPdf(req: AuthRequest, res: Response) {
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  const f = isoDate.safeParse(from);
  const t = isoDate.safeParse(to);
  if (!f.success || !t.success) throw new AppError(400, "תאריכים לא תקינים", "VALIDATION");
  if (f.data > t.data) throw new AppError(400, "תאריך התחלה אחרי תאריך הסיום", "VALIDATION");
  const rows = await buildParkingRows(req, f.data, t.data);
  const subtitle = `${f.data} — ${t.data}`;
  const pdf = await renderParkingPdf("הקצאות חניה", subtitle, rows);
  const safeAscii = `parking-${f.data}-${t.data}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(`חניה-${f.data}-${t.data}.pdf`)}`
  );
  res.send(pdf);
}

const parkingEmailBody = z.object({
  from: isoDate,
  to: isoDate,
  recipientEmail: z.string().email().optional(),
});

export async function parkingEmail(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = parkingEmailBody.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const to = parsed.data.recipientEmail?.trim().toLowerCase() ?? req.user.email.toLowerCase();
  if (to !== req.user.email.toLowerCase()) {
    throw new AppError(400, "ניתן לשלוח דוח רק לאימייל של המשתמש המחובר", "VALIDATION");
  }
  const rows = await buildParkingRows(req, parsed.data.from, parsed.data.to);
  const subtitle = `${parsed.data.from} — ${parsed.data.to}`;
  const pdf = await renderParkingPdf("הקצאות חניה", subtitle, rows);
  const filename = `חניה-${parsed.data.from}-${parsed.data.to}.pdf`;
  await sendPdfByEmail({
    to,
    subject: `דוח הקצאות חניה ${parsed.data.from} — ${parsed.data.to}`,
    text: `מצורף דוח הקצאות חניה לטווח ${parsed.data.from} עד ${parsed.data.to}.\n\nSee You Tomorrow`,
    filename,
    pdf,
  });
  res.json({ ok: true });
}

export const managerOrAdmin = requireManagerOrAdmin;
