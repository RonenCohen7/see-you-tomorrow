import { DB_NAMES, getConnection, getEmployeeModel } from "@syt/shared";

export async function shouldAllowRegistration(): Promise<boolean> {
  const conn = await getConnection(DB_NAMES.employees);
  const Employee = getEmployeeModel(conn);
  const count = await Employee.countDocuments();
  return count === 0;
}
