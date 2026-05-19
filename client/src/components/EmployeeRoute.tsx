import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useRole } from "../store/authContext";
import { defaultLandingForRole } from "../utils/roleRouting";

/** Only JWT role employee (preferences submission). */
export default function EmployeeRoute({ children }: { children: ReactNode }) {
  const role = useRole();
  if (role !== "employee") {
    return <Navigate to={defaultLandingForRole(role)} replace />;
  }
  return <>{children}</>;
}
