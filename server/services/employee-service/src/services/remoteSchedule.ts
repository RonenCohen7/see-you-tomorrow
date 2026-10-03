import { AppError, internalServiceHeaders, logger } from "@syt/shared";

/** Best effort: preferences saved before the employee had a department get it now, and submitted weeks enter the AI pipeline. */
export async function assignDepartmentToPreferencesInternal(employeeId: string, departmentId: string): Promise<void> {
  const base = process.env.SCHEDULE_SERVICE_URL ?? "http://localhost:4005";
  try {
    const res = await fetch(`${base}/internal/attendance-preferences/assign-department`, {
      method: "POST",
      headers: internalServiceHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ employeeId, departmentId }),
    });
    if (!res.ok) {
      logger.warn("assignDepartmentToPreferencesInternal failed", { employeeId, status: res.status });
    }
  } catch (e) {
    logger.warn("assignDepartmentToPreferencesInternal error", { employeeId, e });
  }
}

/** Tell schedule-service to drop all shifts from UTC «today» forward (unless `since` override). Throws if cleanup fails — call before marking employee inactive. */
export async function clearEmployeeFutureSchedulesInternal(
  employeeId: string,
  options?: { fromInclusive?: string }
): Promise<void> {
  const base = process.env.SCHEDULE_SERVICE_URL ?? "http://localhost:4005";
  const body =
    options?.fromInclusive !== undefined
      ? { employeeId, fromInclusive: options.fromInclusive }
      : { employeeId };
  try {
    const res = await fetch(`${base}/internal/schedules/clear-future-for-employee`, {
      method: "POST",
      headers: internalServiceHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      logger.warn("clearEmployeeFutureSchedulesInternal failed", {
        employeeId,
        status: res.status,
        body: t.slice(0, 200),
      });
      throw new AppError(
        502,
        "שירות השיבוצים לא הצליח להסיר שיבוצים עתידיים. נסו שוב מאוחר יותר או הפעילו ניקוי מ«חוקי שיבוץ».",
        "SCHEDULE_CLEAR_FAILED",
        t.slice(0, 500)
      );
    }
  } catch (e) {
    if (e instanceof AppError) throw e;
    logger.warn("clearEmployeeFutureSchedulesInternal error", { employeeId, e });
    throw new AppError(
      502,
      "לא ניתן להתחבר לשירות השיבוצים לניקוי שיבוצים.",
      "SCHEDULE_UNREACHABLE"
    );
  }
}
