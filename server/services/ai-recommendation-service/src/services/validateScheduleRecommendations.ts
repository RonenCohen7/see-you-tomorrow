import type { SchedulingRuleDoc } from "@syt/shared";
import { isUtcFridayOrSaturday } from "../utils/weekendPolicyUtc.js";

export type RecommendationRow = {
  date: string;
  employeeId: string;
  recommendedStatus: string;
};

/** ימי שישי–שבת (UTC על תאריך ה-ISO) לא נספרים לכיסוי מנהלים במשרד. */
function countsAsManagerCoverageDay(dateIso: string): boolean {
  return !isUtcFridayOrSaturday(dateIso);
}

function effectiveLocationUnavailableRules(rules: SchedulingRuleDoc[]): SchedulingRuleDoc[] {
  return rules.filter((r) => r.ruleType === "location_unavailable" && r.isActive);
}

/**
 * `enforceManagerDailyOfficeCoverage` בדיקות כיסוי מנהל באותו אלגוריזם ההמלצה.
 * מתאימות למסך «המלצות AI» שבו בודקים את כל ההמלצה כשלם.
 * צינור העדפות העובד (פנימי) מעדיף `false`: חוק ארגון של נוכחות הנהלה ביום
 * הוא נפרד מבקשת שיבוץ העובד ולא צריך לחסום את יצירת האצווה למנהל.
 *
 * `allowFridaySaturdayOffice` — כשנשלח `true` מאדמין, מאפשר המלצות `office` בשישי–שבת UTC.
 */
export function validateScheduleRecommendations(input: {
  recommendations: RecommendationRow[];
  employees: Array<{ id: string; role: string }>;
  rules: SchedulingRuleDoc[];
  assignmentLocationId?: string;
  /** כברירת מחדל true — מתאים לבדיקה ידנית של כל ההמלצה. */
  enforceManagerDailyOfficeCoverage?: boolean;
  /** כברירת מחדל false — חוק ארגון: אין משרד בשישי–שבת אלא באישור ניהול בכיר (אדמין). */
  allowFridaySaturdayOffice?: boolean;
}): { ok: true } | { ok: false; errors: string[] } {
  const enforceManagerDailyOfficeCoverage = input.enforceManagerDailyOfficeCoverage ?? true;
  const allowFridaySaturdayOffice = input.allowFridaySaturdayOffice === true;
  const errors: string[] = [];
  const employeeById = new Map(input.employees.map((e) => [e.id, e]));

  const byDate = new Map<string, RecommendationRow[]>();
  for (const r of input.recommendations) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
      errors.push(`תאריך לא תקין ב-${r.date}`);
      continue;
    }
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
    if (!employeeById.has(r.employeeId)) {
      errors.push(`עובד לא נמצא במחלקה: ${r.employeeId}`);
    }
  }

  const inactiveRules = effectiveLocationUnavailableRules(input.rules);
  const locForAssignment = input.assignmentLocationId;
  if (locForAssignment) {
    for (const r of input.recommendations) {
      if (r.recommendedStatus !== "office") continue;
      for (const ruleDoc of inactiveRules) {
        const pay = ruleDoc.payload as Record<string, unknown>;
        const bannedLoc = typeof pay.locationId === "string" ? pay.locationId : "";
        const from = typeof pay.effectiveFrom === "string" ? pay.effectiveFrom : undefined;
        const to = typeof pay.effectiveTo === "string" ? pay.effectiveTo : undefined;
        if (!bannedLoc || bannedLoc !== locForAssignment) continue;
        if (!from) continue;
        const effEnd = to ?? "9999-12-31";
        if (r.date >= from && r.date <= effEnd) {
          errors.push(
            `${r.date}: שיבוץ משרד למיקום ${locForAssignment} חסום בחוק ארגון «${pay.note ?? ruleDoc.ruleType}»`
          );
        }
      }
    }
  }

  if (!allowFridaySaturdayOffice) {
    for (const r of input.recommendations) {
      if (r.recommendedStatus === "office" && isUtcFridayOrSaturday(r.date)) {
        errors.push(
          `${r.date}: שיבוץ «משרד» בשישי/שבת (לוח UTC) אינו מותר ברירת מחדל — נדרש אישור מנהל מערכת (אדמין) בבקשת ההפקה`
        );
      }
    }
  }

  if (enforceManagerDailyOfficeCoverage) {
    const datesSeen = [...byDate.keys()].sort();
    const managerIds = new Set(
      input.employees.filter((e) => e.role === "manager" || e.role === "admin").map((e) => e.id)
    );

    const minOfficeRules = input.rules.filter((r) => r.ruleType === "min_managers_office_daily" && r.isActive);
    let minimumManagersOffice = 1;
    if (minOfficeRules.length > 0) {
      minimumManagersOffice = Math.max(
        minimumManagersOffice,
        ...minOfficeRules.map((r) =>
          typeof (r.payload as { minManagers?: unknown }).minManagers === "number"
            ? Number((r.payload as { minManagers: number }).minManagers)
            : 0
        )
      );
    }

    for (const dt of datesSeen) {
      if (!countsAsManagerCoverageDay(dt)) continue;
      let managersInOffice = 0;
      for (const row of byDate.get(dt) ?? []) {
        if (row.recommendedStatus === "office" && managerIds.has(row.employeeId)) managersInOffice++;
      }
      if (managersInOffice < minimumManagersOffice) {
        errors.push(
          `${dt}: נדרשים לפחות ${minimumManagersOffice} משתמש(י) עם תפקיד מנהל/אדמין במשרד; נספרו ${managersInOffice}`
        );
      }
    }
  }

  const dup = new Set<string>();
  for (const row of input.recommendations) {
    const key = `${row.employeeId}|${row.date}`;
    if (dup.has(key)) {
      errors.push(`${row.date}: משבצות כפולות ל-${row.employeeId}`);
    }
    dup.add(key);
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true };
}
