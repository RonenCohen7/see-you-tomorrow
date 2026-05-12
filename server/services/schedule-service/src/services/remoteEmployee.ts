import { logger } from "@syt/shared";

const base = () => process.env.EMPLOYEE_SERVICE_URL ?? "http://localhost:4002";
const secret = () => process.env.INTERNAL_SERVICE_SECRET ?? "";

export type InternalEmployeeBrief = {
  id: string;
  fullName: string;
  email: string;
  departmentId?: string;
  locationId?: string;
  managerId?: string;
  role: string;
};

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

export async function fetchEmployeesByDepartment(departmentId: string): Promise<InternalEmployeeBrief[]> {
  try {
    const res = await fetch(`${base()}/internal/departments/${departmentId}/employees`, {
      headers: { "x-internal-secret": secret() },
    });
    if (!res.ok) {
      logger.warn("fetchEmployeesByDepartment failed", { status: res.status, departmentId });
      return [];
    }
    const data = (await res.json()) as { items: InternalEmployeeBrief[] };
    return data.items ?? [];
  } catch (e) {
    logger.warn("fetchEmployeesByDepartment failed", e);
    return [];
  }
}
