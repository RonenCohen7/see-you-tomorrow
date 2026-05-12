import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useRole } from "../store/authContext";

/** Only JWT role employee (preferences submission). */
export default function EmployeeRoute({ children }: { children: ReactNode }) {
  const role = useRole();
  if (role !== "employee") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
