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

/** Managers/admins who should know about a weekly attendance preference submission (not every dept employee). */
export async function resolvePreferenceSubmissionRecipients(payload: {
  departmentId?: string;
  submitterEmployeeId: string;
  includeAdmins?: boolean;
}): Promise<string[]> {
  const ids = new Set<string>();
  if (payload.departmentId) {
    const dept = await http.fetchDepartment(payload.departmentId);
    if (dept?.managerId) ids.add(dept.managerId);
    const members = await http.fetchDepartmentEmployees(payload.departmentId);
    for (const m of members) {
      if (m.role === "manager" || m.role === "admin") ids.add(m.id);
    }
  }
  if (payload.includeAdmins !== false) {
    const admins = await http.fetchAdminIds();
    for (const a of admins) ids.add(a);
  }
  ids.delete(payload.submitterEmployeeId);
  return [...ids];
}

/** Dept managers/admins/service roles for escalation (not every employee). */
export async function resolveDeptManagersAdminsRecipients(departmentId: string): Promise<string[]> {
  const ids = new Set<string>();
  const dept = await http.fetchDepartment(departmentId);
  if (dept?.managerId) ids.add(dept.managerId);
  const members = await http.fetchDepartmentEmployees(departmentId);
  for (const m of members) {
    if (m.role === "manager" || m.role === "admin") ids.add(m.id);
  }
  const admins = await http.fetchAdminIds();
  for (const a of admins) ids.add(a);
  return [...ids];
}
