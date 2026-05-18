import {
  AppError,
  type CustomScheduleStatusDef,
  CUSTOM_SCHEDULE_STATUS_PREFIX,
  isBuiltinScheduleStatus,
  type ScheduleStatus,
} from "@syt/shared";
import * as orgSettings from "./orgSettingsService.js";

const BUILTIN_LABEL_HE: Record<ScheduleStatus, string> = {
  office: "משרד",
  home: "בית",
  vacation: "חופשה",
  sick: "מחלה",
  off: "לא עובד",
};

/** Hebrew label for emails/in-app messaging (built-ins normalized; customs from org defs). */
export function scheduleStatusLabelHe(
  status: string,
  customDefs?: CustomScheduleStatusDef[] | null | undefined
): string {
  if (isBuiltinScheduleStatus(status)) return BUILTIN_LABEL_HE[status];
  const id =
    status.startsWith(CUSTOM_SCHEDULE_STATUS_PREFIX) ? status.slice(CUSTOM_SCHEDULE_STATUS_PREFIX.length) : "";
  if (!id) return status;
  const def = customDefs?.find((c) => c.id === id);
  return def?.labelHe?.trim() || status;
}

export async function scheduleStatusDisplayHebrew(status: string): Promise<string> {
  const org = await orgSettings.getOrgSchedulesFull();
  return scheduleStatusLabelHe(status, org.customScheduleStatuses);
}

export async function assertStoredScheduleStatusAllowed(status: string): Promise<void> {
  if (isBuiltinScheduleStatus(status)) return;
  if (!status.startsWith(CUSTOM_SCHEDULE_STATUS_PREFIX)) {
    throw new AppError(400, "סטטוס לא תקין", "VALIDATION");
  }
  const id = status.slice(CUSTOM_SCHEDULE_STATUS_PREFIX.length);
  if (!id) throw new AppError(400, "סטטוס ארגוני לא תקין", "VALIDATION");
  const org = await orgSettings.getOrgSchedulesFull();
  const ok = org.customScheduleStatuses?.some((c) => c.id === id);
  if (!ok) {
    throw new AppError(
      400,
      "סטטוס ארגוני לא רשום. הוסיפו אותו תחת «סטטוסי שיבוץ נוספים» בהגדרות (אדמין).",
      "VALIDATION"
    );
  }
}
