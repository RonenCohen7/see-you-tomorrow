import { logger } from "@syt/shared";

const base = () => process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:4006";
const secret = () => process.env.INTERNAL_SERVICE_SECRET ?? "";

export async function notifyScheduleChange(payload: {
  scheduleId: string;
  employeeId: string;
  departmentId?: string;
  locationId?: string;
  workDate: string;
  status: string;
  updatedBy?: string;
  note?: string;
}) {
  try {
    const res = await fetch(`${base()}/internal/notifications/schedule-change`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text();
      logger.warn("notification schedule-change failed", { status: res.status, body: t });
    }
  } catch (e) {
    logger.warn("notifyScheduleChange error", e);
  }
}

export async function notifyScheduleRangeChange(payload: {
  scheduleId: string;
  employeeId: string;
  departmentId?: string;
  locationId?: string;
  workDateFrom: string;
  workDateTo: string;
  dayCount: number;
  status: string;
  updatedBy?: string;
  note?: string;
}) {
  try {
    const res = await fetch(`${base()}/internal/notifications/schedule-range-change`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text();
      logger.warn("notification schedule-range-change failed", { status: res.status, body: t });
    }
  } catch (e) {
    logger.warn("notifyScheduleRangeChange error", e);
  }
}
