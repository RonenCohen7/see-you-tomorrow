import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import api from "../services/api";
import { useAuth, useRole } from "../store/authContext";
import type { Employee } from "../types/models";

/**
 * Calendar reads the whole company for every role.
 * `managedEmployees` is only who a manager may edit (their department).
 */
export function useCompanyCalendarEmployees() {
  const { user } = useAuth();
  const role = useRole();

  const employeesQ = useQuery({
    queryKey: ["employees-company-directory"],
    queryFn: async () => {
      const all: Employee[] = [];
      let page = 1;
      while (true) {
        const { data } = await api.get<{ items: Employee[]; total: number }>(
          `/api/employees?scope=company&page=${page}&limit=100`
        );
        all.push(...data.items);
        if (all.length >= data.total || data.items.length === 0) break;
        page += 1;
      }
      return all;
    },
    enabled: !!user,
  });

  const employeeMap = useMemo(() => {
    const m = new Map<string, Employee>();
    for (const e of employeesQ.data ?? []) m.set(e.id, e);
    return m;
  }, [employeesQ.data]);

  const managedEmployees = useMemo(() => {
    const all = employeesQ.data ?? [];
    if (role !== "manager") return all;
    if (!user?.departmentId) return [];
    return all.filter((e) => e.departmentId === user.departmentId);
  }, [employeesQ.data, role, user?.departmentId]);

  const editableEmployeeIds = useMemo(
    () => (role === "manager" ? new Set(managedEmployees.map((e) => e.id)) : undefined),
    [role, managedEmployees]
  );

  return { employeesQ, employeeMap, managedEmployees, editableEmployeeIds };
}
