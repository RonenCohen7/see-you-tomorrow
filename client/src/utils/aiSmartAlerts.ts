import type { TFunction } from "i18next";
import type { ComponentType } from "react";
import HomeIcon from "@mui/icons-material/Home";
import BeachAccessIcon from "@mui/icons-material/BeachAccess";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import SickIcon from "@mui/icons-material/Sick";
import type { Employee, Schedule } from "../types/models";

/** localStorage key: last smart-alerts signature the user acknowledged on /ai */
export const AI_ALERTS_SIGNATURE_SEEN_KEY = "syt_ai_alerts_signature_seen";

export type AiAlertSeverity = "info" | "warning" | "error";

export type SmartAlert = {
  id: string;
  severity: AiAlertSeverity;
  employeeId: string;
  employeeName: string;
  title: string;
  detail: string;
  Icon: ComponentType<{ fontSize?: "small" | "medium" | "large" }>;
  color: string;
  /** When set, UI shows one row with expandable list (e.g. many employees). */
  groupMembers?: { employeeId: string; employeeName: string }[];
};

const SEVERITY_RANK: Record<AiAlertSeverity, number> = { error: 0, warning: 1, info: 2 };

export function countLeadingStreak(sortedDesc: Schedule[], status: string): number {
  let n = 0;
  for (const s of sortedDesc) {
    if (s.status === status) n++;
    else break;
  }
  return n;
}

/** Consecutive schedule rows from the most recent day where status is not office (per recorded days). */
export function countLeadingNonOfficeStreak(sortedDesc: Schedule[]): number {
  let n = 0;
  for (const s of sortedDesc) {
    if (s.status === "office") break;
    n++;
  }
  return n;
}

/** Heuristic “smart” alerts from recent schedules (same logic as AI recommendations page). */
export function buildSmartAlerts(employees: Employee[], schedules: Schedule[], t: TFunction): SmartAlert[] {
  const empMap = new Map(employees.map((e) => [e.id, e]));
  const byEmp = new Map<string, Schedule[]>();
  for (const s of schedules) {
    const arr = byEmp.get(s.employeeId) ?? [];
    arr.push(s);
    byEmp.set(s.employeeId, arr);
  }

  const out: SmartAlert[] = [];
  const noOfficeGroup: { employeeId: string; employeeName: string; streak: number }[] = [];

  for (const [empId, list] of byEmp.entries()) {
    const emp = empMap.get(empId);
    if (!emp) continue;
    const name = emp.fullName;
    const sortedDesc = [...list].sort((a, b) => b.workDate.localeCompare(a.workDate));
    const last14 = sortedDesc.slice(0, 14);
    const homeDays = last14.filter((s) => s.status === "home").length;
    const officeDays = last14.filter((s) => s.status === "office").length;
    const vacationDays = sortedDesc.filter((s) => s.status === "vacation").length;
    const sickStreak = countLeadingStreak(sortedDesc, "sick");
    const nonOfficeStreak = countLeadingNonOfficeStreak(sortedDesc);

    if (nonOfficeStreak >= 3) {
      noOfficeGroup.push({ employeeId: empId, employeeName: name, streak: nonOfficeStreak });
    }

    if (homeDays >= 8) {
      out.push({
        id: `home-${empId}`,
        severity: homeDays >= 11 ? "error" : "warning",
        employeeId: empId,
        employeeName: name,
        title: t("aiTooMuchHome"),
        detail: `${homeDays} מתוך 14 הימים האחרונים מהבית — מומלץ לחזור למשרד מספר ימים בשבוע.`,
        Icon: HomeIcon,
        color: "#ea580c",
      });
    }

    if (vacationDays > 22) {
      out.push({
        id: `vac-${empId}`,
        severity: "error",
        employeeId: empId,
        employeeName: name,
        title: t("aiVacationOverflow"),
        detail: `${vacationDays} ימי חופשה ב-30 הימים האחרונים — חרג ממכסה סטנדרטית.`,
        Icon: BeachAccessIcon,
        color: "#0d9488",
      });
    }

    if (sickStreak >= 3) {
      out.push({
        id: `sick-${empId}`,
        severity: sickStreak >= 5 ? "error" : "warning",
        employeeId: empId,
        employeeName: name,
        title: t("aiManyConsecutiveSick"),
        detail: `${sickStreak} ימי מחלה רצופים — שווה לבדוק שלום.`,
        Icon: SickIcon,
        color: "#dc2626",
      });
    }
  }

  if (noOfficeGroup.length > 0) {
    noOfficeGroup.sort((a, b) => b.streak - a.streak || a.employeeName.localeCompare(b.employeeName, "he"));
    const maxStreak = Math.max(...noOfficeGroup.map((x) => x.streak));
    out.push({
      id: "noffice-group",
      severity: noOfficeGroup.length >= 8 ? "warning" : "info",
      employeeId: "system",
      employeeName: t("aiGroupNoOfficeTitle", { count: noOfficeGroup.length }),
      title: t("aiGroupNoOfficeChip"),
      detail: t("aiGroupNoOfficeDetail", { streak: maxStreak }),
      Icon: BusinessCenterIcon,
      color: "#2563eb",
      groupMembers: noOfficeGroup.map((x) => ({
        employeeId: x.employeeId,
        employeeName: `${x.employeeName} · ${t("aiGroupNoOfficeStreakDays", { n: x.streak })}`,
      })),
    });
  }

  return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

export function alertsSignature(alerts: SmartAlert[]): string {
  return [...alerts]
    .map((a) => a.id)
    .sort()
    .join("|");
}

export function sortAlertsBySeverity(alerts: SmartAlert[]): SmartAlert[] {
  return [...alerts].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
