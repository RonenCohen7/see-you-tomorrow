import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useRole } from "../store/authContext";
import { defaultLandingForRole } from "../utils/roleRouting";

export default function ManagerOrAdminRoute({ children }: { children: ReactNode }) {
  const role = useRole();
  if (role !== "admin" && role !== "manager") {
    return <Navigate to={defaultLandingForRole(role)} replace />;
  }
  return <>{children}</>;
}
