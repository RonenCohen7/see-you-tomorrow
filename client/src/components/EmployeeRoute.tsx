import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useRole } from "../store/authContext";
import { defaultLandingForRole } from "../utils/roleRouting";

/** Personal weekly preference submission — employees, managers, and admins. */
export default function EmployeeRoute({ children }: { children: ReactNode }) {
  const role = useRole();
  if (role !== "employee" && role !== "manager" && role !== "admin") {
    return <Navigate to={defaultLandingForRole(role)} replace />;
  }
  return <>{children}</>;
}
