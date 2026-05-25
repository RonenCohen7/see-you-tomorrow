import { logger } from "@syt/shared";

const base = () => process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:4006";
const secret = () => process.env.INTERNAL_SERVICE_SECRET ?? "";

async function post(path: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(`${base()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      logger.warn("notification internal failed", { path, status: res.status, body: t.slice(0, 200) });
    }
  } catch (e) {
    logger.warn("notification internal error", { path, e });
  }
}

/** After bulk calendar changes (e.g. clearing future shifts for an inactive employee). */
export async function notifyAuthenticatedDashboardRefresh(): Promise<void> {
  await post("/internal/notifications/dashboard-refresh", {});
}

export async function notifyScheduleChange(payload: {
  scheduleId: string;
  employeeId: string;
  departmentId?: string;
  locationId?: string;
  workDate: string;
  status: string;
  /** Hebrew label shown in sockets/emails/UI (optional for backward compat). */
  statusDisplayHe?: string;
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
      logger.warn("notification schedule-change failed", { status: res.status, body: t.slice(0, 200) });
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
  statusDisplayHe?: string;
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
      logger.warn("notification schedule-range-change failed", { status: res.status, body: t.slice(0, 200) });
    }
  } catch (e) {
    logger.warn("notifyScheduleRangeChange error", e);
  }
}

export async function notifyPreferenceSubmitted(payload: {
  employeeId: string;
  departmentId?: string;
  weekStartSunday: string;
}) {
  try {
    const res = await fetch(`${base()}/internal/notifications/preference-submitted`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text();
      logger.warn("notification preference-submitted failed", { status: res.status, body: t.slice(0, 200) });
    }
  } catch (e) {
    logger.warn("notifyPreferenceSubmitted error", e);
  }
}

export async function notifyPreferencePipelineQueued(payload: {
  departmentId: string;
  weekStartSunday: string;
  submitterEmployeeIds: string[];
}) {
  await post("/internal/notifications/preference-pipeline-queued", payload as unknown as Record<string, unknown>);
}

export async function notifyPreferencePipelineAiReady(payload: {
  departmentId: string;
  weekStartSunday: string;
  batchId: string;
  submitterEmployeeIds: string[];
  summary?: {
    matchedPreference?: number;
    differsFromPreference?: number;
    noSubmittedPreferenceForSlot?: number;
    recommendationRows?: number;
  };
}) {
  await post("/internal/notifications/preference-pipeline-ai-ready", payload as unknown as Record<string, unknown>);
}

export async function notifyPreferencePipelineAiFailed(payload: {
  departmentId: string;
  weekStartSunday: string;
  submitterEmployeeIds: string[];
  message: string;
}) {
  await post("/internal/notifications/preference-pipeline-ai-failed", payload as unknown as Record<string, unknown>);
}

export async function notifyPreferencePipelineValidationIssueManagers(payload: {
  departmentId: string;
  weekStartSunday: string;
  message: string;
}) {
  await post("/internal/notifications/preference-pipeline-validation-managers", payload as unknown as Record<string, unknown>);
}

export async function notifyPreferencePipelineNoLocation(payload: {
  departmentId: string;
  weekStartSunday: string;
  submitterEmployeeIds: string[];
}) {
  await post("/internal/notifications/preference-pipeline-no-location", payload as unknown as Record<string, unknown>);
}

export async function notifyPreferencePipelineApplied(payload: {
  departmentId: string;
  weekStartSunday: string;
  submitterEmployeeIds: string[];
}) {
  await post("/internal/notifications/preference-pipeline-applied", payload as unknown as Record<string, unknown>);
}

export async function notifyPreferencePipelineRejected(payload: {
  departmentId: string;
  weekStartSunday: string;
  submitterEmployeeIds: string[];
}) {
  await post("/internal/notifications/preference-pipeline-rejected", payload as unknown as Record<string, unknown>);
}

export async function notifySchedulingRuleProposal(payload: {
  proposalId: string;
  summary: string;
  conflictCount: number;
  submitterUserId: string;
}) {
  await post("/internal/notifications/scheduling-rule-proposal", payload as unknown as Record<string, unknown>);
}

export async function notifyPreferencePipelineBatchPendingManagers(payload: {
  departmentId: string;
  weekStartSunday: string;
  batchId: string;
}) {
  await post(
    "/internal/notifications/preference-pipeline-batch-pending-managers",
    payload as unknown as Record<string, unknown>
  );
}
