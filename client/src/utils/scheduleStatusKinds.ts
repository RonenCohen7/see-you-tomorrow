export const BUILTIN_SCHEDULE_STATUSES = ["office", "home", "vacation", "sick", "off"] as const;
export type BuiltinScheduleStatus = (typeof BUILTIN_SCHEDULE_STATUSES)[number];

export function isBuiltinScheduleStatus(s: string): s is BuiltinScheduleStatus {
  return (BUILTIN_SCHEDULE_STATUSES as readonly string[]).includes(s);
}

export type OrgCustomScheduleStatusDef = {
  id: string;
  labelHe: string;
  labelEn?: string;
};

export function customScheduleStoredValue(id: string): string {
  return `custom:${id}`;
}

export function statusRowClassSuffix(status: string): string {
  return status.replace(/[^a-zA-Z0-9_-]/g, "_");
}
