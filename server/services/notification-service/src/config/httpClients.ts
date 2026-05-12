import { logger } from "@syt/shared";

const empBase = () => process.env.EMPLOYEE_SERVICE_URL ?? "http://localhost:4002";
const depBase = () => process.env.DEPARTMENT_SERVICE_URL ?? "http://localhost:4003";
const secret = () => process.env.INTERNAL_SERVICE_SECRET ?? "";

async function internal(path: string, base: () => string) {
  const res = await fetch(`${base()}${path}`, {
    headers: { "x-internal-secret": secret() },
  });
  if (!res.ok) {
    logger.warn(`internal ${path} failed`, res.status);
    return null;
  }
  return res.json();
}

export async function fetchEmployee(id: string) {
  return internal(`/internal/employees/${id}`, empBase) as Promise<{
    id: string;
    fullName?: string;
    email?: string;
    departmentId?: string;
    managerId?: string;
  } | null>;
}

export async function fetchDepartmentEmployees(departmentId: string) {
  const data = (await internal(`/internal/departments/${departmentId}/employees`, empBase)) as {
    items: Array<{ id: string; role?: string }>;
  } | null;
  return data?.items ?? [];
}

export async function fetchDepartment(deptId: string) {
  return internal(`/internal/departments/${deptId}`, depBase) as Promise<{
    id: string;
    managerId?: string;
  } | null>;
}

export async function fetchAdminIds() {
  const data = (await internal(`/internal/employees/admins`, empBase)) as { ids: string[] } | null;
  return data?.ids ?? [];
}
