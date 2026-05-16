import Papa from "papaparse";
import type { MaritalStatus } from "../types/models";

export type BulkImportEmployeePayload = {
  fullName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  departmentId?: string;
  locationId?: string;
  managerId?: string;
  role?: "admin" | "manager" | "employee";
  isActive?: boolean;
  birthDate?: string;
  address?: string;
  maritalStatus?: MaritalStatus | "";
  emergencyContact?: string;
  notes?: string;
};

export type CsvParseIssue =
  | { row: number; code: "MISSING_REQUIRED" }
  | { row: number; code: "INVALID_EMAIL" }
  | { row: number; code: "INVALID_OBJECT_ID"; field: string }
  | { row: number; code: "INVALID_ROLE" }
  | { row: number; code: "INVALID_MARITAL" }
  | { row: number; code: "INVALID_BIRTHDATE" }
  | { row: number; code: "INVALID_ISACTIVE" };

const OID_RE = /^[a-f\d]{24}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function optionalOid(raw: string | undefined, field: string): { ok: true; id?: string } | { ok: false; field: string } {
  const v = raw?.trim() ?? "";
  if (!v) return { ok: true, id: undefined };
  if (!OID_RE.test(v)) return { ok: false, field };
  return { ok: true, id: v };
}

export function parseEmployeesCsv(text: string, maritalStatuses: readonly MaritalStatus[]): {
  rows: BulkImportEmployeePayload[];
  issues: CsvParseIssue[];
  parserMessages: string[];
  missingColumns: boolean;
} {
  const parserMessages: string[] = [];
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
  });

  for (const err of parsed.errors) {
    parserMessages.push(err.message);
  }

  const fields = parsed.meta.fields ?? [];
  const hasFullName = fields.includes("fullName");
  const hasEmail = fields.includes("email");
  const missingColumns = !hasFullName || !hasEmail;

  const maritalSet = new Set(maritalStatuses);
  const issues: CsvParseIssue[] = [];
  const rows: BulkImportEmployeePayload[] = [];

  const data = parsed.data ?? [];
  for (let idx = 0; idx < data.length; idx++) {
    const rowNum = idx + 2;
    const rec = data[idx];
    const fullName = (rec.fullName ?? "").trim();
    const email = (rec.email ?? "").trim();

    if (!fullName && !email) continue;

    if (!fullName || !email) {
      issues.push({ row: rowNum, code: "MISSING_REQUIRED" });
      continue;
    }

    if (!SIMPLE_EMAIL.test(email)) {
      issues.push({ row: rowNum, code: "INVALID_EMAIL" });
      continue;
    }

    const out: BulkImportEmployeePayload = { fullName, email };

    const phone = (rec.phone ?? "").trim();
    if (phone) out.phone = phone;

    const jobTitle = (rec.jobTitle ?? "").trim();
    if (jobTitle) out.jobTitle = jobTitle;

    const roleRaw = (rec.role ?? "").trim().toLowerCase();
    if (roleRaw) {
      if (roleRaw !== "admin" && roleRaw !== "manager" && roleRaw !== "employee") {
        issues.push({ row: rowNum, code: "INVALID_ROLE" });
        continue;
      }
      out.role = roleRaw;
    }

    let oidFailed = false;
    for (const col of ["departmentId", "locationId", "managerId"] as const) {
      const oid = optionalOid(rec[col], col);
      if (!oid.ok) {
        issues.push({ row: rowNum, code: "INVALID_OBJECT_ID", field: oid.field });
        oidFailed = true;
        break;
      }
      if (oid.id) out[col] = oid.id;
    }
    if (oidFailed) continue;

    const birthRaw = (rec.birthDate ?? "").trim();
    if (birthRaw) {
      if (!ISO_DATE.test(birthRaw)) {
        issues.push({ row: rowNum, code: "INVALID_BIRTHDATE" });
        continue;
      }
      out.birthDate = birthRaw;
    }

    const address = (rec.address ?? "").trim();
    if (address) out.address = address;

    const msRaw = (rec.maritalStatus ?? "").trim();
    if (msRaw) {
      if (!maritalSet.has(msRaw as MaritalStatus)) {
        issues.push({ row: rowNum, code: "INVALID_MARITAL" });
        continue;
      }
      out.maritalStatus = msRaw as MaritalStatus;
    }

    const ec = (rec.emergencyContact ?? "").trim();
    if (ec) out.emergencyContact = ec;

    const notes = (rec.notes ?? "").trim();
    if (notes) out.notes = notes;

    const iaRaw = (rec.isActive ?? "").trim().toLowerCase();
    if (iaRaw) {
      if (iaRaw !== "true" && iaRaw !== "false") {
        issues.push({ row: rowNum, code: "INVALID_ISACTIVE" });
        continue;
      }
      out.isActive = iaRaw === "true";
    }

    rows.push(out);
  }

  return { rows, issues, parserMessages, missingColumns };
}
