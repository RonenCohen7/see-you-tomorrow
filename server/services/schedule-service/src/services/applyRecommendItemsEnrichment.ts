import type { ScheduleStatus } from "@syt/shared";
import * as remoteDepartment from "./remoteDepartment.js";
import * as remoteEmployee from "./remoteEmployee.js";

const hex24 = /^[a-f\d]{24}$/i;

type ApplyBodyItem = {
  employeeId: string;
  workDate: string;
  status: ScheduleStatus;
  departmentId?: string;
  locationId?: string;
  note?: string;
};

/**
 * Rows coming from approve-recommendations often omit locationId even when approve UI had no location —
 * breaks office parking auto-assign. Fill from aiMeta.locationId, department.locationId, or employee.locationId.
 */
export async function enrichApplyRecommendationItems(
  items: ApplyBodyItem[],
  aiMeta?: { locationId?: string; departmentId?: string }
): Promise<ApplyBodyItem[]> {
  const metaLoc =
    aiMeta?.locationId && hex24.test(aiMeta.locationId) ? aiMeta.locationId.trim() : undefined;
  const metaDept =
    aiMeta?.departmentId && hex24.test(aiMeta.departmentId) ? aiMeta.departmentId.trim() : undefined;

  const deptLocCache = new Map<string, string | undefined>();

  const deptLocation = async (deptId?: string): Promise<string | undefined> => {
    if (!deptId || !hex24.test(deptId)) return undefined;
    if (deptLocCache.has(deptId)) {
      const c = deptLocCache.get(deptId);
      return c && hex24.test(c) ? c : undefined;
    }
    const dep = await remoteDepartment.fetchDepartmentPublic(deptId);
    const loc = dep?.locationId?.trim();
    const ok = loc && hex24.test(loc) ? loc : undefined;
    deptLocCache.set(deptId, ok);
    return ok;
  };

  const out: ApplyBodyItem[] = [];
  for (const raw of items) {
    const i = { ...raw };
    if (i.status !== "office") {
      out.push(i);
      continue;
    }
    if (i.locationId && hex24.test(i.locationId)) {
      out.push({ ...i, locationId: i.locationId.trim() });
      continue;
    }
    let loc = metaLoc;
    if (!loc) {
      const fromDept =
        i.departmentId && hex24.test(i.departmentId) ? await deptLocation(i.departmentId.trim()) : undefined;
      loc = fromDept ?? (metaDept ? await deptLocation(metaDept) : undefined);
    }
    if (!loc) {
      const emp = await remoteEmployee.fetchEmployeeInternal(i.employeeId.trim());
      const el = emp?.locationId?.trim();
      loc = el && hex24.test(el) ? el : undefined;
    }
    if (loc) {
      i.locationId = loc;
    }
    out.push(i);
  }
  return out;
}
