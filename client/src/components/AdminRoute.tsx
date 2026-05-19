import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useRole } from "../store/authContext";
import { defaultLandingForRole } from "../utils/roleRouting";

export default function AdminRoute({ children }: { children: ReactNode }) {
  const role = useRole();
  if (role !== "admin") {
    return <Navigate to={defaultLandingForRole(role)} replace />;
  }
  return <>{children}</>;
}
