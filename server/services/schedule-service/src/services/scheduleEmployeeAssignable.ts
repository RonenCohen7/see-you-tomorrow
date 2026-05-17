import { AppError } from "@syt/shared";
import * as empRemote from "./remoteEmployee.js";

/** Blocks creating or editing schedule rows while the employee profile is inactive. */
export async function assertEmployeeAssignableForScheduleWrites(employeeId: string): Promise<void> {
  const emp = await empRemote.fetchEmployeeInternal(employeeId);
  if (!emp) throw new AppError(404, "עובד לא נמצא", "NOT_FOUND");
  if (emp.isActive === false) {
    throw new AppError(
      400,
      "לא ניתן לעדכן או לשבץ עובד שאינו פעיל בלוח הזמנים. יש להפעיל את העובד מתפריט העובדים או למחוק משמרות קיימות.",
      "EMPLOYEE_INACTIVE"
    );
  }
}
