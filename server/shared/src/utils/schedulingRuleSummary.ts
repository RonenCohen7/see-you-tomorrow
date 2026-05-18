import type { SchedulingRuleType } from "../models/schedulingRule.js";
import type { SchedulingRuleWire } from "./schedulingRuleConflicts.js";

export type RuleImpactTag = "ai_validation" | "parking_on_save";

export function describeRuleImpact(ruleType: SchedulingRuleType): RuleImpactTag[] {
  if (ruleType === "manager_office_auto_parking") return ["parking_on_save"];
  return ["ai_validation"];
}

export function summarizeRule(
  rule: Pick<SchedulingRuleWire, "ruleType" | "payload">,
  locale: "he" | "en",
  locationNameById?: Map<string, string>,
): string {
  if (rule.ruleType === "location_unavailable") {
    const p = rule.payload;
    const lid = typeof p.locationId === "string" ? p.locationId : "";
    const from = typeof p.effectiveFrom === "string" ? p.effectiveFrom : "";
    const to = typeof p.effectiveTo === "string" ? p.effectiveTo : "";
    const note = typeof p.note === "string" ? p.note : "";
    const name =
      locationNameById?.get(lid) ?? (lid.length >= 8 ? `${lid.slice(0, 8)}…` : lid);
    if (locale === "en") {
      const range = to ? `${from} → ${to}` : `from ${from}`;
      return [name, range, note].filter(Boolean).join(" · ");
    }
    const range = to ? `${from} → ${to}` : from;
    return [name, range, note].filter(Boolean).join(" · ");
  }
  if (rule.ruleType === "min_managers_office_daily") {
    const n = rule.payload.minManagers;
    const num = typeof n === "number" ? n : "?";
    return locale === "en"
      ? `At least ${num} manager(s)/admin(s) in office per weekday (Fri–Sat excluded)`
      : `לפחות ${num} מנהלים/אדמין במשרד ביום עבודה (לא שישי–שבת)`;
  }
  if (rule.ruleType === "manager_office_auto_parking") {
    return locale === "en"
      ? "Auto-assign guest parking when a manager/admin is set to office with a location"
      : "הקצאת חנייה אוטומטית כשמנהל/אדמין במשרד עם מיקום";
  }
  return rule.ruleType;
}

export function ruleTypeLabel(ruleType: SchedulingRuleType, locale: "he" | "en"): string {
  const labels: Record<SchedulingRuleType, { he: string; en: string }> = {
    location_unavailable: {
      he: "מיקום לא זמין",
      en: "Location unavailable",
    },
    min_managers_office_daily: {
      he: "מינימום מנהלים במשרד",
      en: "Minimum managers in office",
    },
    manager_office_auto_parking: {
      he: "חנייה אוטומטית למנהל במשרד",
      en: "Manager office auto-parking",
    },
  };
  return labels[ruleType][locale];
}

export function impactTagLabel(tag: RuleImpactTag, locale: "he" | "en"): string {
  if (tag === "ai_validation") return locale === "en" ? "AI recommendations" : "המלצות AI";
  return locale === "en" ? "Parking on save" : "חנייה בשמירה";
}
