import Papa from "papaparse";
import type { MaritalStatus } from "../types/models";
import { EMPLOYEE_REQUIRED_FIELD_KEYS, type EmployeeRequiredFieldKey } from "./employeeRequirements";

export type BulkImportEmployeePayload = {
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  departmentId: string;
  locationId?: string;
  managerId?: string;
  role?: "admin" | "manager" | "employee";
  isActive?: boolean;
  birthDate: string;
  address: string;
  maritalStatus: MaritalStatus;
  emergencyContact?: string;
  notes?: string;
};

export type CsvParseIssue =
  | { row: number; code: "MISSING_REQUIRED" }
  | { row: number; code: "INVALID_EMAIL" }
  | { row: number; code: "INVALID_ROLE" }
  | { row: number; code: "INVALID_MARITAL" }
  | { row: number; code: "INVALID_BIRTHDATE" }
  | { row: number; code: "INVALID_ISACTIVE" }
  | { row: number; code: "MISSING_REQUIRED_FIELD"; field: EmployeeRequiredFieldKey }
  | { row: number; code: "INVALID_REFERENCE_ID"; field: EmployeeRequiredFieldKey };

export type CsvAdaptation =
  | { kind: "header_alias"; from: string; to: string }
  | { kind: "birthdate_reformatted"; row: number; from: string; to: string }
  | { kind: "marital_mapped"; row: number; from: string; to: MaritalStatus }
  | { kind: "role_mapped"; row: number; from: string; to: "admin" | "manager" | "employee" }
  | { kind: "deferred_reference_column"; column: string }
  | { kind: "unmapped_column"; column: string };

export type ParseEmployeesCsvResult = {
  rows: BulkImportEmployeePayload[];
  issues: CsvParseIssue[];
  parserMessages: string[];
  missingRequiredColumns: readonly EmployeeRequiredFieldKey[];
  adaptations: CsvAdaptation[];
  extrasPerRow: Record<string, string>[];
};

const OID_RE = /^[a-f\d]{24}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const KNOWN_COLUMNS = new Set([
  "fullName",
  "email",
  "phone",
  "jobTitle",
  "departmentId",
  "locationId",
  "managerId",
  "role",
  "isActive",
  "birthDate",
  "address",
  "maritalStatus",
  "emergencyContact",
  "notes",
]);

const HEADER_LOOKUP = new Map<string, string>(
  (
    [
      ["fullName", "fullName"],
      ["fullname", "fullName"],
      ["name", "fullName"],
      ["full name", "fullName"],
      ["employee name", "fullName"],
      ["שם מלא", "fullName"],
      ["שם", "fullName"],
      ["אימייל", "email"],
      ["כתובת מייל", "email"],
      ["דוא״ל", "email"],
      ["דואל", "email"],
      ["דואמייל", "email"],
      ["email", "email"],
      ["e-mail", "email"],
      ["mail", "email"],
      ["phone", "phone"],
      ["mobile", "phone"],
      ["cell", "phone"],
      ["טלפון", "phone"],
      ["נייד", "phone"],
      ["jobTitle", "jobTitle"],
      ["jobtitle", "jobTitle"],
      ["job title", "jobTitle"],
      ["position", "jobTitle"],
      ["תפקיד", "jobTitle"],
      ["תואר תפקיד", "jobTitle"],
      ["departmentId", "departmentId"],
      ["departmentid", "departmentId"],
      ["department id", "departmentId"],
      ["department", "departmentId"],
      ["מחלקה", "departmentId"],
      ["יחידה ארגונית", "departmentId"],
      ["locationId", "locationId"],
      ["locationid", "locationId"],
      ["location id", "locationId"],
      ["site", "locationId"],
      ["office", "locationId"],
      ["מיקום", "locationId"],
      ["משרד", "locationId"],
      ["managerId", "managerId"],
      ["managerid", "managerId"],
      ["manager id", "managerId"],
      ["מזהה מנהל", "managerId"],
      ["מנהל ישיר", "managerId"],
      ["role", "role"],
      ["הרשאה", "role"],
      ["דרגה", "role"],
      ["birthDate", "birthDate"],
      ["birthdate", "birthDate"],
      ["birth date", "birthDate"],
      ["birthday", "birthDate"],
      ["תאריך לידה", "birthDate"],
      ["address", "address"],
      ["כתובת", "address"],
      ["maritalStatus", "maritalStatus"],
      ["maritalstatus", "maritalStatus"],
      ["marital status", "maritalStatus"],
      ["מצב משפחתי", "maritalStatus"],
      ["סטטוס משפחתי", "maritalStatus"],
      ["emergencyContact", "emergencyContact"],
      ["emergencycontact", "emergencyContact"],
      ["emergency contact", "emergencyContact"],
      ["איש קשר חירום", "emergencyContact"],
      ["טל חירום", "emergencyContact"],
      ["notes", "notes"],
      ["הערות", "notes"],
      ["remark", "notes"],
      ["remarks", "notes"],
      ["isActive", "isActive"],
      ["isactive", "isActive"],
      ["active", "isActive"],
      ["פעיל", "isActive"],
    ] as const
  ).map(([a, b]) => [a, b])
);

function isAsciiOnly(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) >= 128) return false;
  }
  return true;
}

function canonicalHeader(trimmedRaw: string): string | undefined {
  const hit = HEADER_LOOKUP.get(trimmedRaw);
  if (hit) return hit;
  if (isAsciiOnly(trimmedRaw)) return HEADER_LOOKUP.get(trimmedRaw.trim().toLowerCase());
  return undefined;
}

function deferredFieldLabel(field: "locationId" | "managerId", canonLabel: ReadonlyMap<string, string>): string {
  return canonLabel.get(field) ?? field;
}

export function applyUnmappedExtrasToNotes(
  rows: BulkImportEmployeePayload[],
  extrasPerRow: Record<string, string>[]
): BulkImportEmployeePayload[] {
  return rows.map((row, idx) => {
    const extras = extrasPerRow[idx];
    if (!extras) return row;
    const entries = Object.entries(extras).filter(([, v]) => v.trim().length > 0);
    if (!entries.length) return row;
    entries.sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    const block = entries.map(([k, v]) => `${k}: ${v.trim()}`).join("\n");
    const existing = row.notes?.trim();
    return { ...row, notes: existing ? `${existing}\n${block}` : block };
  });
}

function normalizeYMD(year: number, month: number, day: number): string | undefined {
  if (
    year < 1000 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > 31 ||
    !Number.isInteger(year)
  ) {
    return undefined;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return undefined;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeBirthDate(raw: string, rowNum: number, adaptations: CsvAdaptation[]): string | undefined {
  const input = raw.trim();
  if (!input) return undefined;

  const isoAny = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(input);
  if (isoAny) {
    const ymd = normalizeYMD(Number(isoAny[1]), Number(isoAny[2]), Number(isoAny[3]));
    if (!ymd) return undefined;
    if (input.replace(/\//g, "-").replace(/\./g, "-") !== ymd) {
      adaptations.push({ kind: "birthdate_reformatted", row: rowNum, from: input, to: ymd });
    }
    return ymd;
  }

  const dmySlashed = /^(\d{1,2})[/.\s-](\d{1,2})[/.\s-](\d{4})$/.exec(input);
  if (!dmySlashed) return undefined;

  const d = Number(dmySlashed[1]);
  const month = Number(dmySlashed[2]);
  const year = Number(dmySlashed[3]);
  const ymd = normalizeYMD(year, month, d);
  if (!ymd) return undefined;
  adaptations.push({ kind: "birthdate_reformatted", row: rowNum, from: input, to: ymd });
  return ymd;
}

const MARITAL_FROM_HEBREW: Record<string, MaritalStatus> = {
  רווק: "single",
  רווקה: "single",
  נשוי: "married",
  נשואה: "married",
  נשואים: "married",
  גרוש: "divorced",
  גרושה: "divorced",
  אלמן: "widowed",
  אלמנה: "widowed",
  אלמון: "widowed",
  "ידועים בציבור": "partner",
  זוגיות: "partner",
};

const ROLE_FROM_LABEL: Record<string, "admin" | "manager" | "employee"> = {
  admin: "admin",
  administrator: "admin",
  mgr: "manager",
  emp: "employee",
  עובד: "employee",
  מנהל: "manager",
  "מנהל מערכת": "admin",
  אדמין: "admin",
};

function normalizeMarital(
  raw: string,
  maritalSet: ReadonlySet<MaritalStatus>,
  rowNum: number,
  adaptations: CsvAdaptation[]
): MaritalStatus | "" | "__invalid__" {
  const t = raw.trim();
  if (!t) return "";
  const asStatus = t as MaritalStatus;
  if (maritalSet.has(asStatus)) return asStatus;
  const lower = t.toLowerCase();
  if (maritalSet.has(lower as MaritalStatus)) {
    adaptations.push({ kind: "marital_mapped", row: rowNum, from: t, to: lower as MaritalStatus });
    return lower as MaritalStatus;
  }

  const he = MARITAL_FROM_HEBREW[t];
  if (he) {
    adaptations.push({ kind: "marital_mapped", row: rowNum, from: t, to: he });
    return he;
  }
  return "__invalid__";
}

function normalizeRole(raw: string, rowNum: number, adaptations: CsvAdaptation[]): "" | "__invalid__" | "admin" | "manager" | "employee" {
  const t = raw.trim();
  if (!t) return "";

  const lower = t.toLowerCase();
  if (lower === "admin" || lower === "manager" || lower === "employee") return lower;

  const mapped = ROLE_FROM_LABEL[t] ?? ROLE_FROM_LABEL[lower];
  if (mapped) {
    adaptations.push({ kind: "role_mapped", row: rowNum, from: t, to: mapped });
    return mapped;
  }
  return "__invalid__";
}

function normalizeIsActive(raw: string): boolean | "__invalid__" | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const lower = t.toLowerCase();

  const trues = new Set(["true", "1", "yes", "y", "כן"]);
  const falses = new Set(["false", "0", "no", "n", "לא"]);

  if (trues.has(lower) || t === "פעיל") return true;
  if (falses.has(lower) || t === "לא פעיל") return false;

  return "__invalid__";
}

export function csvImportNeedsNotesConsent(extrasPerRow: Record<string, string>[]): boolean {
  return extrasPerRow.some((ex) => Object.keys(ex ?? {}).some((k) => (ex[k] ?? "").trim().length > 0));
}

export function parseEmployeesCsv(text: string, maritalStatuses: readonly MaritalStatus[]): ParseEmployeesCsvResult {
  const parserMessages: string[] = [];
  const adaptations: CsvAdaptation[] = [];
  const maritalSet = new Set(maritalStatuses);
  const canonicalOriginalLabel = new Map<string, string>();
  const headerAliasKeys = new Set<string>();
  const deferredNoticeCols = new Set<string>();

  const transformHeader = (raw: string) => {
    const trimmed = raw.replace(/^\uFEFF/, "").trim().replace(/\s+/g, " ");
    if (!trimmed) return trimmed;
    const canon = canonicalHeader(trimmed);
    if (canon) {
      if (!canonicalOriginalLabel.has(canon)) canonicalOriginalLabel.set(canon, trimmed);
      const ak = `${trimmed}→${canon}`;
      if (!headerAliasKeys.has(ak)) {
        headerAliasKeys.add(ak);
        if (trimmed !== canon)
          adaptations.push({
            kind: "header_alias",
            from: trimmed,
            to: canon,
          });
      }
      return canon;
    }
    return trimmed;
  };

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader,
  });

  for (const err of parsed.errors) {
    parserMessages.push(err.message);
  }

  const fields = (parsed.meta.fields ?? []).map((h) => h.trim()).filter(Boolean);
  const missingRequiredColumns = EMPLOYEE_REQUIRED_FIELD_KEYS.filter((k) => !fields.includes(k));

  const unmappedCols = [...new Set(fields.filter((f) => !KNOWN_COLUMNS.has(f)))];
  for (const column of unmappedCols) adaptations.push({ kind: "unmapped_column", column });

  const rows: BulkImportEmployeePayload[] = [];
  const extrasPerRow: Record<string, string>[] = [];
  const issues: CsvParseIssue[] = [];

  const data = parsed.data ?? [];

  for (let idx = 0; idx < data.length; idx++) {
    const rowNum = idx + 2;
    const rec = data[idx];
    const rowExtras: Record<string, string> = {};
    const rowIssues: CsvParseIssue[] = [];

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

    const phone = (rec.phone ?? "").trim();
    if (!phone) rowIssues.push({ row: rowNum, code: "MISSING_REQUIRED_FIELD", field: "phone" });
    const jobTitle = (rec.jobTitle ?? "").trim();
    if (!jobTitle) rowIssues.push({ row: rowNum, code: "MISSING_REQUIRED_FIELD", field: "jobTitle" });
    const address = (rec.address ?? "").trim();
    if (!address) rowIssues.push({ row: rowNum, code: "MISSING_REQUIRED_FIELD", field: "address" });

    const birthRaw = (rec.birthDate ?? "").trim();
    let birthIso: string | undefined;
    if (!birthRaw) rowIssues.push({ row: rowNum, code: "MISSING_REQUIRED_FIELD", field: "birthDate" });
    else {
      birthIso = normalizeBirthDate(birthRaw, rowNum, adaptations);
      if (!birthIso || !ISO_DATE.test(birthIso)) {
        issues.push({ row: rowNum, code: "INVALID_BIRTHDATE" });
        continue;
      }
    }

    const deptRaw = (rec.departmentId ?? "").trim();
    if (!deptRaw) rowIssues.push({ row: rowNum, code: "MISSING_REQUIRED_FIELD", field: "departmentId" });
    else if (!OID_RE.test(deptRaw)) {
      issues.push({ row: rowNum, code: "INVALID_REFERENCE_ID", field: "departmentId" });
      continue;
    }

    const maritalRaw = (rec.maritalStatus ?? "").trim();
    let maritalOut: MaritalStatus | undefined;
    if (!maritalRaw) rowIssues.push({ row: rowNum, code: "MISSING_REQUIRED_FIELD", field: "maritalStatus" });
    else {
      const msParsed = normalizeMarital(maritalRaw, maritalSet, rowNum, adaptations);
      if (msParsed === "__invalid__") {
        issues.push({ row: rowNum, code: "INVALID_MARITAL" });
        continue;
      }
      if (msParsed) maritalOut = msParsed;
    }

    const roleParsed = normalizeRole((rec.role ?? "").trim(), rowNum, adaptations);
    if ((rec.role ?? "").trim()) {
      if (roleParsed === "__invalid__") {
        issues.push({ row: rowNum, code: "INVALID_ROLE" });
        continue;
      }
    }

    const deferRef = (field: "locationId" | "managerId", value: string) => {
      const label = deferredFieldLabel(field, canonicalOriginalLabel);
      rowExtras[label] = value;
      if (!deferredNoticeCols.has(label)) {
        deferredNoticeCols.add(label);
        adaptations.push({ kind: "deferred_reference_column", column: label });
      }
    };

    let outLocId: string | undefined;
    let outMgrId: string | undefined;
    for (const field of ["locationId", "managerId"] as const) {
      const v = (rec[field] ?? "").trim();
      if (!v) continue;
      if (OID_RE.test(v)) {
        if (field === "locationId") outLocId = v;
        else outMgrId = v;
      } else deferRef(field, v);
    }

    const ec = (rec.emergencyContact ?? "").trim();
    const notes = (rec.notes ?? "").trim();

    const iaParsed = normalizeIsActive((rec.isActive ?? "").trim());
    if ((rec.isActive ?? "").trim()) {
      if (iaParsed === "__invalid__") {
        issues.push({ row: rowNum, code: "INVALID_ISACTIVE" });
        continue;
      }
    }

    if (rowIssues.length > 0) {
      issues.push(...rowIssues);
      continue;
    }

    const out: BulkImportEmployeePayload = {
      fullName,
      email,
      phone,
      jobTitle,
      departmentId: deptRaw,
      birthDate: birthIso as string,
      address,
      maritalStatus: maritalOut as MaritalStatus,
      ...(notes ? { notes } : {}),
      ...(ec ? { emergencyContact: ec } : {}),
      ...(roleParsed && roleParsed !== "__invalid__" ? { role: roleParsed as "admin" | "manager" | "employee" } : {}),
      ...(iaParsed !== undefined && iaParsed !== "__invalid__" ? { isActive: iaParsed } : {}),
      ...(outLocId ? { locationId: outLocId } : {}),
      ...(outMgrId ? { managerId: outMgrId } : {}),
    };

    for (const col of unmappedCols) {
      const cell = (rec[col] ?? "").trim();
      if (cell) rowExtras[col] = cell;
    }

    rows.push(out);
    extrasPerRow.push(rowExtras);
  }

  return {
    rows,
    issues,
    parserMessages,
    missingRequiredColumns,
    adaptations,
    extrasPerRow,
  };
}
