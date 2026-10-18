import type { PreferenceDayEntry, ScheduleStatus } from "@syt/shared";
import * as svc from "./scheduleService.js";
import * as pref from "./attendancePreferenceService.js";
import * as orgSettings from "./orgSettingsService.js";
import { enrichApplyRecommendationItems } from "./applyRecommendItemsEnrichment.js";

/**
 * Writes an employee's submitted week straight to the board. Each chosen day replaces whatever is there
 * (manual entries included); days left empty or locked by the lead time are not touched.
 */
export async function applySubmittedPreferenceInstantly(input: {
  employeeId: string;
  departmentId?: string;
  days: PreferenceDayEntry[];
}): Promise<number> {
  const firstEditable = pref.firstEditablePreferenceDate(await orgSettings.getPreferenceMinDaysAhead());
  const chosen = input.days.filter(
    (d): d is PreferenceDayEntry & { preference: ScheduleStatus } =>
      !!d.preference && d.workDate >= firstEditable
  );
  if (chosen.length === 0) return 0;

  const enriched = await enrichApplyRecommendationItems(
    chosen.map((d) => ({
      employeeId: input.employeeId,
      workDate: d.workDate,
      status: d.preference,
      ...(input.departmentId ? { departmentId: input.departmentId } : {}),
    }))
  );

  const results = await svc.upsertBulkInternal(
    enriched.map((i) => ({ ...i, updatedBy: input.employeeId, source: "manual" as const })),
    { replaceDay: true, skipNotifications: true }
  );
  return results.length;
}
