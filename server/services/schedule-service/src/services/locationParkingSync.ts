import { logger } from "@syt/shared";
import * as rules from "./schedulingRuleService.js";

const base = () => process.env.LOCATION_SERVICE_URL ?? "http://127.0.0.1:4004";
const secret = () => process.env.INTERNAL_SERVICE_SECRET ?? "";

export type ScheduleParkingSyncRow = {
  employeeId: string;
  workDate: string;
  status: string;
  /** Optional; required for reserving a spot at a specific site when status is office. */
  locationId?: string | null;
};

async function syncManagerOfficeAutoParkingInternal(row: ScheduleParkingSyncRow) {
  if (!(await rules.hasActiveRuleType("manager_office_auto_parking"))) return;

  const res = await fetch(`${base()}/internal/parking/sync-manager-office-auto`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": secret() },
    body: JSON.stringify({
      employeeId: row.employeeId,
      workDate: row.workDate,
      status: row.status,
      locationId:
        typeof row.locationId === "string" && /^[a-f\d]{24}$/i.test(row.locationId.trim())
          ? row.locationId.trim()
          : undefined,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    logger.warn("sync manager-office auto parking failed", {
      status: res.status,
      body: txt.slice(0, 300),
      employeeId: row.employeeId,
      workDate: row.workDate,
    });
  }
}

export function enqueueParkingSyncAfterScheduleWrite(row: ScheduleParkingSyncRow): void {
  void syncManagerOfficeAutoParkingInternal(row).catch((e) =>
    logger.warn("sync manager-office auto parking error", {
      employeeId: row.employeeId,
      workDate: row.workDate,
      err: String(e),
    })
  );
}
