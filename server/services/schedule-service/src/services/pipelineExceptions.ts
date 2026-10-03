import type { ScheduleAiBatchException, ScheduleAiBatchItem } from "@syt/shared";
import { utcDay } from "../utils/dateRange.js";

type SubmittedPreferenceDoc = {
  employeeId: string;
  days?: Array<{ workDate: string; preference?: string }>;
};

export function defaultAiConstraints() {
  const minOffice = Number(process.env.PREFERENCE_AI_MIN_OFFICE_PER_DAY ?? 3);
  const cap = Number(process.env.PREFERENCE_AI_MAX_OFFICE_CAPACITY ?? 50);
  return {
    minOfficeEmployeesPerDay: Number.isFinite(minOffice) ? minOffice : 3,
    maxOfficeCapacity: Number.isFinite(cap) && cap >= 1 ? cap : 50,
    preferredOfficeDays: ["Monday", "Wednesday"],
  };
}

function isFridayOrSaturday(isoDate: string): boolean {
  const dow = utcDay(isoDate).getUTCDay();
  return dow === 5 || dow === 6;
}

/**
 * A batch with no exceptions is applied without a manager:
 * - every submitted day preference was kept (weekend office is overridden by policy, not an exception);
 * - on each workday, the requests to be away still leave the minimum office headcount available
 *   (skipped for departments smaller than the minimum);
 * - no day exceeds office capacity.
 */
export function findPipelineExceptions(input: {
  items: ScheduleAiBatchItem[];
  submitted: SubmittedPreferenceDoc[];
  minOfficePerDay: number;
  maxOfficeCapacity: number;
}): ScheduleAiBatchException[] {
  const prefBySlot = new Map<string, string>();
  for (const doc of input.submitted) {
    for (const d of doc.days ?? []) {
      if (d.workDate && d.preference) prefBySlot.set(`${doc.employeeId}|${d.workDate}`, d.preference);
    }
  }

  const exceptions: ScheduleAiBatchException[] = [];
  const byDate = new Map<string, ScheduleAiBatchItem[]>();
  for (const item of input.items) {
    const list = byDate.get(item.date) ?? [];
    list.push(item);
    byDate.set(item.date, list);

    const requested = prefBySlot.get(`${item.employeeId}|${item.date}`);
    if (!requested || requested === item.recommendedStatus) continue;
    if (requested === "office" && isFridayOrSaturday(item.date)) continue;
    exceptions.push({
      kind: "preference_overridden",
      date: item.date,
      employeeId: item.employeeId,
      requestedStatus: requested,
      assignedStatus: item.recommendedStatus,
    });
  }

  for (const [date, rows] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (isFridayOrSaturday(date)) continue;
    const officeCount = rows.filter((r) => r.recommendedStatus === "office").length;
    const available = rows.filter((r) => {
      const requested = prefBySlot.get(`${r.employeeId}|${date}`);
      return !requested || requested === "office";
    }).length;
    if (rows.length >= input.minOfficePerDay && available < input.minOfficePerDay) {
      exceptions.push({ kind: "office_shortfall", date, officeCount: available, required: input.minOfficePerDay });
    }
    if (officeCount > input.maxOfficeCapacity) {
      exceptions.push({ kind: "office_over_capacity", date, officeCount, capacity: input.maxOfficeCapacity });
    }
  }

  return exceptions;
}
