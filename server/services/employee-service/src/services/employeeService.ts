import bcrypt from "bcryptjs";
import type { Types } from "mongoose";
import {
  AppError,
  DB_NAMES,
  getConnection,
  getEmployeeModel,
  isAppError,
  type MaritalStatus,
  type Role,
} from "@syt/shared";
import type { EmployeeDoc } from "@syt/shared";

export function toPublic(doc: EmployeeDoc) {
  return {
    id: doc._id.toString(),
    fullName: doc.fullName,
    email: doc.email,
    phone: doc.phone,
    imageUrl: doc.imageUrl,
    jobTitle: doc.jobTitle,
    departmentId: doc.departmentId?.toString(),
    locationId: doc.locationId?.toString(),
    managerId: doc.managerId?.toString(),
    role: doc.role,
    isActive: doc.isActive,
    birthDate: doc.birthDate ? doc.birthDate.toISOString().slice(0, 10) : undefined,
    address: doc.address,
    maritalStatus: doc.maritalStatus,
    emergencyContact: doc.emergencyContact,
    notes: doc.notes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function getModel() {
  const conn = await getConnection(DB_NAMES.employees);
  return getEmployeeModel(conn);
}

export async function createEmployee(input: {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  imageUrl?: string;
  jobTitle?: string;
  departmentId?: string;
  locationId?: string;
  managerId?: string;
  role?: Role;
  isActive?: boolean;
  birthDate?: string;
  address?: string;
  maritalStatus?: MaritalStatus | "";
  emergencyContact?: string;
  notes?: string;
}) {
  const Employee = await getModel();
  const exists = await Employee.findOne({ email: input.email.toLowerCase() });
  if (exists) throw new AppError(409, "כתובת האימייל כבר בשימוש", "EMAIL_EXISTS");

  const hashed = await bcrypt.hash(input.password, 12);
  const doc = await Employee.create({
    fullName: input.fullName,
    email: input.email.toLowerCase(),
    password: hashed,
    phone: input.phone,
    imageUrl: input.imageUrl || undefined,
    jobTitle: input.jobTitle,
    departmentId: input.departmentId,
    locationId: input.locationId,
    managerId: input.managerId,
    role: input.role ?? "employee",
    isActive: input.isActive ?? true,
    birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
    address: input.address,
    maritalStatus: input.maritalStatus || undefined,
    emergencyContact: input.emergencyContact,
    notes: input.notes,
  });
  return toPublic(doc);
}

export type BulkImportEmployeeError = {
  row: number;
  email?: string;
  code: string;
  message: string;
};

export async function importEmployeesBulk(input: {
  defaultPassword: string;
  rows: Array<Omit<Parameters<typeof createEmployee>[0], "password">>;
}): Promise<{
  created: number;
  skippedExisting: number;
  skippedInvalid: number;
  errors: BulkImportEmployeeError[];
}> {
  let created = 0;
  let skippedExisting = 0;
  let skippedInvalid = 0;
  const errors: BulkImportEmployeeError[] = [];
  const seenInFile = new Set<string>();

  const Employee = await getModel();

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i];
    const rowNum = i + 1;
    const emailNorm = row.email.trim().toLowerCase();
    const fullNameTrimmed = row.fullName.trim();

    if (!fullNameTrimmed || !emailNorm) {
      skippedInvalid++;
      errors.push({
        row: rowNum,
        email: row.email || undefined,
        code: "MISSING_REQUIRED",
        message: "חסרים שם מלא או אימייל",
      });
      continue;
    }

    if (seenInFile.has(emailNorm)) {
      skippedInvalid++;
      errors.push({
        row: rowNum,
        email: row.email,
        code: "DUPLICATE_IN_FILE",
        message: "אותו אימייל מופיע בשורות קודמות בקובץ",
      });
      continue;
    }
    seenInFile.add(emailNorm);

    const exists = await Employee.findOne({ email: emailNorm }).select("_id").lean();
    if (exists) {
      skippedExisting++;
      continue;
    }

    try {
      await createEmployee({
        ...row,
        fullName: fullNameTrimmed,
        email: emailNorm,
        password: input.defaultPassword,
      });
      created++;
    } catch (e: unknown) {
      if (isAppError(e) && e.code === "EMAIL_EXISTS") {
        skippedExisting++;
        continue;
      }
      const dup =
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        Number((e as { code: unknown }).code) === 11000;
      if (dup) {
        skippedExisting++;
        continue;
      }
      skippedInvalid++;
      const msg = isAppError(e) ? e.message : "שגיאה ביצירת עובד";
      errors.push({
        row: rowNum,
        email: row.email,
        code: isAppError(e) && e.code ? String(e.code) : "CREATE_FAILED",
        message: msg,
      });
    }
  }

  return { created, skippedExisting, skippedInvalid, errors };
}

export async function updateEmployee(
  id: string,
  input: Partial<{
    fullName: string;
    email: string;
    password: string;
    phone: string;
    imageUrl: string;
    jobTitle: string;
    departmentId: string;
    locationId: string;
    managerId: string;
    role: Role;
    isActive: boolean;
    birthDate: string;
    address: string;
    maritalStatus: MaritalStatus | "";
    emergencyContact: string;
    notes: string;
  }>
) {
  const Employee = await getModel();
  const doc = await Employee.findById(id);
  if (!doc) throw new AppError(404, "עובד לא נמצא", "NOT_FOUND");

  if (input.email && input.email !== doc.email) {
    const clash = await Employee.findOne({ email: input.email.toLowerCase() });
    if (clash) throw new AppError(409, "כתובת האימייל כבר בשימוש", "EMAIL_EXISTS");
    doc.email = input.email.toLowerCase();
  }
  if (input.fullName !== undefined) doc.fullName = input.fullName;
  if (input.phone !== undefined) doc.phone = input.phone;
  if (input.imageUrl !== undefined) doc.imageUrl = input.imageUrl || undefined;
  if (input.jobTitle !== undefined) doc.jobTitle = input.jobTitle;
  if (input.departmentId !== undefined) doc.departmentId = input.departmentId as unknown as Types.ObjectId;
  if (input.locationId !== undefined) doc.locationId = input.locationId as unknown as Types.ObjectId;
  if (input.managerId !== undefined) doc.managerId = input.managerId as unknown as Types.ObjectId;
  if (input.role !== undefined) doc.role = input.role;
  if (input.isActive !== undefined) doc.isActive = input.isActive;
  if (input.birthDate !== undefined) doc.birthDate = input.birthDate ? new Date(input.birthDate) : undefined;
  if (input.address !== undefined) doc.address = input.address || undefined;
  if (input.maritalStatus !== undefined) doc.maritalStatus = input.maritalStatus || undefined;
  if (input.emergencyContact !== undefined) doc.emergencyContact = input.emergencyContact || undefined;
  if (input.notes !== undefined) doc.notes = input.notes || undefined;
  if (input.password) doc.password = await bcrypt.hash(input.password, 12);

  await doc.save();
  return toPublic(doc);
}

export async function deleteEmployee(id: string) {
  const Employee = await getModel();
  const doc = await Employee.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!doc) throw new AppError(404, "עובד לא נמצא", "NOT_FOUND");
  return toPublic(doc);
}

export async function getById(id: string) {
  const Employee = await getModel();
  const doc = await Employee.findById(id);
  if (!doc) throw new AppError(404, "עובד לא נמצא", "NOT_FOUND");
  return toPublic(doc);
}

export async function getMe(id: string) {
  return getById(id);
}

export async function listEmployees(
  query: {
    page: number;
    limit: number;
    search?: string;
    departmentId?: string;
    locationId?: string;
    role?: Role;
    isActive?: boolean;
  },
  scope?: { role: Role; userId: string; departmentId?: string }
) {
  const Employee = await getModel();
  const filter: Record<string, unknown> = {};

  if (scope?.role === "manager") {
    if (!scope.departmentId) {
      return {
        items: [],
        total: 0,
        page: query.page,
        limit: query.limit,
      };
    }
    filter.departmentId = scope.departmentId;
  }

  if (query.search) {
    filter.$or = [
      { fullName: new RegExp(query.search, "i") },
      { email: new RegExp(query.search, "i") },
    ];
  }
  if (query.departmentId) filter.departmentId = query.departmentId;
  if (query.locationId) filter.locationId = query.locationId;
  if (query.role) filter.role = query.role;
  if (query.isActive !== undefined) filter.isActive = query.isActive;

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    Employee.find(filter).sort({ fullName: 1 }).skip(skip).limit(query.limit).lean(),
    Employee.countDocuments(filter),
  ]);

  return {
    items: items.map((d) => toPublic(d as unknown as EmployeeDoc)),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export async function getManagerDepartmentId(userId: string): Promise<string | undefined> {
  const Employee = await getModel();
  const me = await Employee.findById(userId).lean();
  return me?.departmentId?.toString();
}

export async function internalGetById(id: string) {
  const Employee = await getModel();
  const doc = await Employee.findById(id).lean();
  if (!doc) return null;
  return toPublic(doc as unknown as EmployeeDoc);
}

export async function internalListByDepartment(departmentId: string) {
  const Employee = await getModel();
  const docs = await Employee.find({ departmentId, isActive: true }).lean();
  return docs.map((d) => toPublic(d as unknown as EmployeeDoc));
}

export async function internalAdminIds(): Promise<string[]> {
  const Employee = await getModel();
  const docs = await Employee.find({ role: "admin", isActive: true }).select("_id").lean();
  return docs.map((d) => d._id.toString());
}

export async function internalIdsByRole(role: Role): Promise<string[]> {
  const Employee = await getModel();
  const docs = await Employee.find({ role, isActive: true }).select("_id").lean();
  return docs.map((d) => d._id.toString());
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function birthdayMatchesCalendarDay(birthIso: string, calY: number, calM: number, calD: number): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthIso.trim());
  if (!m) return false;
  const bm = Number(m[2]);
  const bd = Number(m[3]);
  if (calM !== bm) return false;
  if (calD === bd) return true;
  if (bm === 2 && bd === 29 && calD === 28 && !isLeapYear(calY)) return true;
  return false;
}

function parseIsoLocalStart(iso: string): Date {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

function formatIsoLocal(d: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export type BirthdayRangeHit = { employeeId: string; fullName: string; date: string };

/** Birthdays in [fromIso, toIso] for users the caller may see (admin: all; manager/employee: same department). */
export async function listBirthdaysInRange(
  fromIso: string,
  toIso: string,
  user: { id: string; role: Role }
): Promise<{ items: BirthdayRangeHit[] }> {
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoRe.test(fromIso) || !isoRe.test(toIso)) {
    throw new AppError(400, "תאריכים לא תקינים", "VALIDATION");
  }

  const from = parseIsoLocalStart(fromIso);
  const to = parseIsoLocalStart(toIso);
  if (from.getTime() > to.getTime()) {
    throw new AppError(400, "תאריך התחלה אחרי סיום", "VALIDATION");
  }
  const maxMs = 370 * 86400000;
  if (to.getTime() - from.getTime() > maxMs) {
    throw new AppError(400, "טווח תאריכים ארוך מדי", "VALIDATION");
  }

  const Employee = await getModel();
  const filter: Record<string, unknown> = { isActive: true, birthDate: { $ne: null, $exists: true } };

  if (user.role === "manager" || user.role === "employee") {
    const dept = await getManagerDepartmentId(user.id);
    if (!dept) return { items: [] };
    filter.departmentId = dept;
  }

  const docs = await Employee.find(filter).select("_id fullName birthDate").lean();
  const items: BirthdayRangeHit[] = [];

  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  while (cur.getTime() <= end.getTime()) {
    const y = cur.getFullYear();
    const month = cur.getMonth() + 1;
    const day = cur.getDate();
    const dateStr = formatIsoLocal(cur);

    for (const row of docs) {
      const raw = row.birthDate;
      const birthIso =
        raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw ?? "").slice(0, 10);
      if (birthIso.length < 10) continue;
      if (birthdayMatchesCalendarDay(birthIso, y, month, day)) {
        items.push({ employeeId: row._id.toString(), fullName: String(row.fullName ?? ""), date: dateStr });
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  items.sort((a, b) => a.date.localeCompare(b.date) || a.fullName.localeCompare(b.fullName, "he"));
  return { items };
}
