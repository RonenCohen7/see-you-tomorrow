import { logger } from "@syt/shared";

const base = () => process.env.EMPLOYEE_SERVICE_URL ?? "http://localhost:4002";
const secret = () => process.env.INTERNAL_SERVICE_SECRET ?? "";

export async function fetchEmployeeInternal(id: string) {
  try {
    const res = await fetch(`${base()}/internal/employees/${id}`, {
      headers: { "x-internal-secret": secret() },
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      id: string;
      departmentId?: string;
      locationId?: string;
      managerId?: string;
      role: string;
    };
  } catch (e) {
    logger.warn("fetchEmployeeInternal failed", e);
    return null;
  }
}
