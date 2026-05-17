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
      isActive?: boolean;
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

export type InternalInactiveEmployeeIdsPage = {
  ids: string[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export async function fetchInactiveEmployeeIdsPage(
  page: number,
  limit = 200
): Promise<InternalInactiveEmployeeIdsPage | null> {
  try {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    const res = await fetch(`${base()}/internal/employees/inactive-ids?${qs}`, {
      headers: { "x-internal-secret": secret() },
    });
    if (!res.ok) {
      logger.warn("fetchInactiveEmployeeIdsPage failed", { status: res.status, page });
      return null;
    }
    return (await res.json()) as InternalInactiveEmployeeIdsPage;
  } catch (e) {
    logger.warn("fetchInactiveEmployeeIdsPage failed", e);
    return null;
  }
}
