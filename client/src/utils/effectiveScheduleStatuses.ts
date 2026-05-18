import type { StatusKey } from "../theme/theme";
import { STATUS_ORDER } from "./statusMeta";
import { isBuiltinScheduleStatus } from "./scheduleStatusKinds";

export type OrgStatusesWire = {
  disabledBuiltinScheduleStatuses?: string[];
  customScheduleStatuses?: { id: string; disabled?: boolean }[];
} & Record<string, unknown>;

/** Builtin keys still shown in pickers / reports tabs (excluding org-disabled). */
export function selectableBuiltinStatusKeys(disabledBuiltin: string[] | undefined): StatusKey[] {
  const d = new Set(disabledBuiltin ?? []);
  return STATUS_ORDER.filter((k) => !d.has(k));
}

export function selectableCustomStatuses<T extends { id: string; disabled?: boolean }>(
  customs: T[] | undefined,
): T[] {
  return (customs ?? []).filter((c) => !c.disabled);
}

/** Whether this stored status appears in UX / daily report eligibility (org policy). */
export function isStoredStatusSelectableInOrg(status: string, org: OrgStatusesWire | undefined): boolean {
  if (!org) {
    return isBuiltinScheduleStatus(status)
      ? (STATUS_ORDER as readonly string[]).includes(status as StatusKey)
      : status.startsWith("custom:");
  }
  const disB = new Set(org.disabledBuiltinScheduleStatuses ?? []);
  if (isBuiltinScheduleStatus(status)) {
    return !disB.has(status);
  }
  if (!status.startsWith("custom:")) return false;
  const idHex = status.slice("custom:".length);
  const c = (org.customScheduleStatuses ?? []).find((x) => x.id.toLowerCase() === idHex.toLowerCase());
  return !!c && !c.disabled;
}
