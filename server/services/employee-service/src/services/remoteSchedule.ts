import { AppError, logger } from "@syt/shared";

/** Tell schedule-service to drop all shifts from UTC «today» forward (unless `since` override). Throws if cleanup fails — call before marking employee inactive. */
export async function clearEmployeeFutureSchedulesInternal(
  employeeId: string,
  options?: { fromInclusive?: string }
): Promise<void> {
  const base = process.env.SCHEDULE_SERVICE_URL ?? "http://localhost:4005";
  const secret = process.env.INTERNAL_SERVICE_SECRET ?? "";
  const body =
    options?.fromInclusive !== undefined
      ? { employeeId, fromInclusive: options.fromInclusive }
      : { employeeId };
  try {
    const res = await fetch(`${base}/internal/schedules/clear-future-for-employee`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
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
