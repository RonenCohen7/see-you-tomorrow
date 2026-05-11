import * as http from "../config/httpClients.js";

export async function resolveScheduleRecipients(payload: {
  employeeId: string;
  departmentId?: string;
  includeAdmins?: boolean;
}): Promise<string[]> {
  const ids = new Set<string>();
  ids.add(payload.employeeId);

  const emp = await http.fetchEmployee(payload.employeeId);
  if (emp?.managerId) ids.add(emp.managerId);

  let deptId = payload.departmentId ?? emp?.departmentId;
  if (deptId) {
    const dept = await http.fetchDepartment(deptId);
    if (dept?.managerId) ids.add(dept.managerId);

    const members = await http.fetchDepartmentEmployees(deptId);
    for (const m of members) ids.add(m.id);
  }

  if (payload.includeAdmins !== false) {
    const admins = await http.fetchAdminIds();
    for (const a of admins) ids.add(a);
  }

  return [...ids];
}
