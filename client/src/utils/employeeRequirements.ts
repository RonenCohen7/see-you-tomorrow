import type { Employee } from "../types/models";

/** Canonical field keys required for קליטת עובד (CSV ידני ובדיקות שלמות). */
export const EMPLOYEE_REQUIRED_FIELD_KEYS = [
  "fullName",
  "email",
  "birthDate",
  "phone",
  "address",
  "maritalStatus",
  "jobTitle",
  "departmentId",
] as const;

export type EmployeeRequiredFieldKey = (typeof EMPLOYEE_REQUIRED_FIELD_KEYS)[number];

const OID_RE = /^[a-f\d]{24}$/i;

function oidLike(s?: string | null): boolean {
  const v = s?.trim() ?? "";
  return v.length > 0 && OID_RE.test(v);
}

/** רשימת שדות חובה שחסרים או לא תקינים במסמך עובד מהמערכת. */
export function employeeMissingRequiredFields(emp: Employee): EmployeeRequiredFieldKey[] {
  const miss: EmployeeRequiredFieldKey[] = [];
  if (!emp.fullName?.trim()) miss.push("fullName");
  if (!emp.email?.trim()) miss.push("email");
  if (!emp.birthDate?.trim()) miss.push("birthDate");
  if (!emp.phone?.trim()) miss.push("phone");
  if (!emp.address?.trim()) miss.push("address");
  if (!emp.maritalStatus) miss.push("maritalStatus");
  if (!emp.jobTitle?.trim()) miss.push("jobTitle");
  if (!oidLike(emp.departmentId)) miss.push("departmentId");
  return miss;
}
