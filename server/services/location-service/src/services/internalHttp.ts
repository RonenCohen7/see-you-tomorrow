import { logger } from "@syt/shared";

const schedBase = () => process.env.SCHEDULE_SERVICE_URL ?? "http://127.0.0.1:4005";
const empBase = () => process.env.EMPLOYEE_SERVICE_URL ?? "http://127.0.0.1:4002";
const secret = () => process.env.INTERNAL_SERVICE_SECRET ?? "";

export async function scheduleOfficePresence(
  checks: { employeeId: string; workDate: string }[]
): Promise<{ employeeId: string; workDate: string; hasOffice: boolean }[]> {
  if (checks.length === 0) return [];
  try {
    const res = await fetch(`${schedBase()}/internal/schedules/office-presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": secret() },
      body: JSON.stringify({ checks }),
    });
    if (!res.ok) {
      logger.warn("scheduleOfficePresence failed", { status: res.status });
      throw new Error(`schedule internal ${res.status}`);
    }
    const data = (await res.json()) as {
      results: { employeeId: string; workDate: string; hasOffice: boolean }[];
    };
    return data.results;
  } catch (e) {
    logger.warn("scheduleOfficePresence error", e);
    throw e;
  }
}

export async function fetchEmployeeInternal(id: string) {
  try {
    const res = await fetch(`${empBase()}/internal/employees/${id}`, {
      headers: { "x-internal-secret": secret() },
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      id: string;
      departmentId?: string;
      fullName?: string;
      role: string;
    };
  } catch (e) {
    logger.warn("fetchEmployeeInternal failed", e);
    return null;
  }
}
